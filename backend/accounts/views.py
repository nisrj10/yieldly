from rest_framework import generics, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from datetime import timedelta, datetime
import secrets
import csv
import io
import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from decimal import Decimal, InvalidOperation
from .models import Household, HouseholdInvitation, AppIntegration
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    HouseholdSerializer,
    InviteToHouseholdSerializer,
    HouseholdInvitationSerializer,
    AppIntegrationSerializer,
    AcceptInvitationSerializer,
)
from finance.models import Transaction, Account, Category

User = get_user_model()

WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
WHOOP_API_BASE_URL = 'https://api.prod.whoop.com/developer/v2'
WHOOP_SCOPES = 'offline read:profile read:recovery read:cycles read:sleep read:workout'
WHOOP_USER_AGENT = 'Yieldly/1.0 (+https://yiedly-backend-fcbb8734fb56.herokuapp.com)'
SNOOP_EXPORT_HELP_URL = 'https://snoopadmin.zendesk.com/hc/en-gb/articles/18255143766429-Can-I-export-my-transactions-from-Snoop'
SNOOP_CONTACT_EMAIL = 'hello@snoop.app'


def _app_base_url(request):
    configured_url = os.environ.get('APP_BASE_URL') or os.environ.get('FRONTEND_URL')
    if configured_url:
        return configured_url.rstrip('/')
    return request.build_absolute_uri('/').rstrip('/')


def _whoop_redirect_uri(request):
    configured_uri = os.environ.get('WHOOP_REDIRECT_URI')
    if configured_uri:
        return configured_uri
    return f"{_app_base_url(request)}/api/auth/whoop/callback/"


def _whoop_credentials_configured():
    return bool(os.environ.get('WHOOP_CLIENT_ID') and os.environ.get('WHOOP_CLIENT_SECRET'))


def _snoop_api_configured():
    return bool(os.environ.get('SNOOP_API_BASE_URL') and os.environ.get('SNOOP_API_TOKEN'))


def _snoop_export_instructions():
    return [
        'Open the Snoop app',
        'Go to All transactions',
        'Tap Export',
        'Download the CSV file',
        'Upload the CSV into Yieldly Integrations',
    ]


def _whoop_request(path, access_token, params=None):
    query = f"?{urlencode(params)}" if params else ''
    request = Request(
        f"{WHOOP_API_BASE_URL}{path}{query}",
        headers={
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
            'User-Agent': WHOOP_USER_AGENT,
        },
    )
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def _whoop_token_request(payload):
    form = urlencode({
        **payload,
        'client_id': os.environ.get('WHOOP_CLIENT_ID', ''),
        'client_secret': os.environ.get('WHOOP_CLIENT_SECRET', ''),
    }).encode('utf-8')
    token_request = Request(
        WHOOP_TOKEN_URL,
        data=form,
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': WHOOP_USER_AGENT,
        },
        method='POST',
    )
    with urlopen(token_request, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def _refresh_whoop_token(integration):
    if not integration.refresh_token:
        return integration.access_token

    token_payload = _whoop_token_request({
        'grant_type': 'refresh_token',
        'refresh_token': integration.refresh_token,
    })
    integration.access_token = token_payload.get('access_token', integration.access_token)
    integration.refresh_token = token_payload.get('refresh_token', integration.refresh_token)

    expires_in = token_payload.get('expires_in')
    integration.token_expires_at = (
        timezone.now() + timedelta(seconds=int(expires_in))
        if expires_in else None
    )
    integration.status = 'connected'
    integration.sync_error = ''
    integration.save(update_fields=[
        'access_token',
        'refresh_token',
        'token_expires_at',
        'status',
        'sync_error',
        'updated_at',
    ])
    return integration.access_token


def _whoop_access_token(integration):
    if (
        integration.token_expires_at
        and integration.token_expires_at <= timezone.now() + timedelta(minutes=5)
    ):
        return _refresh_whoop_token(integration)
    return integration.access_token


def _format_whoop_error(prefix, exc):
    if isinstance(exc, HTTPError):
        try:
            detail = exc.read().decode('utf-8')
        except Exception:
            detail = ''
        if detail:
            return f'{prefix}: HTTP {exc.code}: {detail[:300]}'
    return f'{prefix}: {exc}'


def _whoop_paginated(path, access_token, params):
    records = []
    next_token = None
    while True:
        request_params = {**params, 'limit': 25}
        if next_token:
            request_params['nextToken'] = next_token
        payload = _whoop_request(path, access_token, request_params)
        records.extend(payload.get('records', []))
        next_token = payload.get('next_token')
        if not next_token:
            return records


def _safe_average(values):
    values = [value for value in values if value is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _duration_hours(milliseconds):
    if not milliseconds:
        return None
    return round(milliseconds / 1000 / 60 / 60, 2)


def _whoop_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).date().isoformat()
    except ValueError:
        return value[:10]


def _merge_daily_record(daily, day, values):
    if not day:
        return
    record = daily.setdefault(day, {'date': day})
    for key, value in values.items():
        if value is not None:
            record[key] = value


def _period_summary(days):
    days = [day for day in days if day]
    if not days:
        return None
    return {
        'days': len(days),
        'avg_recovery': _safe_average([day.get('recovery_score') for day in days]),
        'avg_hrv': _safe_average([day.get('hrv_rmssd_milli') for day in days]),
        'avg_rhr': _safe_average([day.get('resting_heart_rate') for day in days]),
        'avg_strain': _safe_average([day.get('strain') for day in days]),
        'avg_sleep_performance': _safe_average([day.get('sleep_performance_percentage') for day in days]),
        'avg_sleep_hours': _safe_average([day.get('sleep_hours_in_bed') for day in days]),
    }


def _guidance_from_summary(latest, periods):
    recovery = latest.get('recovery_score')
    sleep = latest.get('sleep_performance_percentage')
    strain = latest.get('strain')
    weekly = periods.get('week') or {}

    focus = []
    if recovery is not None and recovery >= 67:
        focus.append('Green recovery: good day for important work or a controlled training push.')
    elif recovery is not None and recovery < 34:
        focus.append('Low recovery: keep strain light, hydrate, and protect sleep tonight.')
    elif recovery is not None:
        focus.append('Moderate recovery: normal work is fine, but avoid stacking hard training with a late night.')

    if sleep is not None and sleep < 70:
        focus.append('Sleep is the limiter today; make an earlier night the main intervention.')
    elif sleep is not None and sleep >= 85:
        focus.append('Sleep supported recovery well; maintain the routine that produced it.')

    if strain is not None and strain >= 14:
        focus.append('Yesterday was high strain, so watch for delayed fatigue today.')

    weekly_sleep = weekly.get('avg_sleep_hours')
    if weekly_sleep is not None and weekly_sleep < 6.5:
        focus.append('This week is carrying sleep debt; schedule at least one 8 hour recovery night.')

    return focus[:4] or ['No strong warning signs in the latest WHOOP snapshot. Keep routines steady.']


def _summarize_whoop_data(cycles, recoveries, sleeps):
    scored_recoveries = [
        item for item in recoveries
        if item.get('score_state') == 'SCORED' and item.get('score')
    ]
    scored_sleeps = [
        item for item in sleeps
        if item.get('score_state') == 'SCORED' and item.get('score')
    ]
    scored_cycles = [
        item for item in cycles
        if item.get('score_state') == 'SCORED' and item.get('score')
    ]

    recovery_scores = [item['score'].get('recovery_score') for item in scored_recoveries]
    strain_scores = [item['score'].get('strain') for item in scored_cycles]
    sleep_performance = [
        item['score'].get('sleep_performance_percentage')
        for item in scored_sleeps
    ]
    sleep_durations = [
        item['score'].get('stage_summary', {}).get('total_in_bed_time_milli')
        for item in scored_sleeps
    ]

    daily = {}
    cycle_dates = {}
    for item in scored_cycles:
        score = item.get('score', {})
        day = _whoop_date(item.get('start'))
        cycle_id = item.get('id')
        if cycle_id is not None and day:
            cycle_dates[str(cycle_id)] = day
        _merge_daily_record(daily, day, {
            'cycle_id': item.get('id'),
            'strain': score.get('strain'),
            'average_heart_rate': score.get('average_heart_rate'),
            'max_heart_rate': score.get('max_heart_rate'),
            'kilojoule': score.get('kilojoule'),
        })

    for item in scored_recoveries:
        score = item.get('score', {})
        day = cycle_dates.get(str(item.get('cycle_id'))) or _whoop_date(item.get('created_at') or item.get('updated_at'))
        _merge_daily_record(daily, day, {
            'recovery_score': score.get('recovery_score'),
            'hrv_rmssd_milli': score.get('hrv_rmssd_milli'),
            'resting_heart_rate': score.get('resting_heart_rate'),
            'spo2_percentage': score.get('spo2_percentage'),
            'skin_temp_celsius': score.get('skin_temp_celsius'),
        })

    for item in scored_sleeps:
        score = item.get('score', {})
        stages = score.get('stage_summary', {})
        day = cycle_dates.get(str(item.get('cycle_id'))) or _whoop_date(item.get('end') or item.get('start'))
        _merge_daily_record(daily, day, {
            'sleep_performance_percentage': score.get('sleep_performance_percentage'),
            'sleep_efficiency_percentage': score.get('sleep_efficiency_percentage'),
            'sleep_consistency_percentage': score.get('sleep_consistency_percentage'),
            'sleep_hours_in_bed': _duration_hours(stages.get('total_in_bed_time_milli')),
            'awake_hours': _duration_hours(stages.get('total_awake_time_milli')),
            'rem_hours': _duration_hours(stages.get('total_rem_sleep_time_milli')),
            'light_hours': _duration_hours(stages.get('total_light_sleep_time_milli')),
            'deep_hours': _duration_hours(stages.get('total_slow_wave_sleep_time_milli')),
            'disturbance_count': score.get('disturbance_count'),
            'sleep_cycle_count': score.get('sleep_cycle_count'),
            'respiratory_rate': score.get('respiratory_rate'),
        })

    daily_rows = sorted(daily.values(), key=lambda item: item['date'], reverse=True)
    latest_day = daily_rows[0] if daily_rows else {}
    trend = list(reversed(daily_rows[:30]))
    periods = {
        'day': _period_summary(daily_rows[:1]),
        'week': _period_summary(daily_rows[:7]),
        'month': _period_summary(daily_rows[:30]),
    }

    summary = {
        'updated_at': timezone.now().isoformat(),
        'records': {
            'cycles': len(cycles),
            'recoveries': len(recoveries),
            'sleeps': len(sleeps),
        },
        'averages': {
            'recovery_score': _safe_average(recovery_scores),
            'hrv_rmssd_milli': _safe_average([
                item['score'].get('hrv_rmssd_milli') for item in scored_recoveries
            ]),
            'resting_heart_rate': _safe_average([
                item['score'].get('resting_heart_rate') for item in scored_recoveries
            ]),
            'strain': _safe_average(strain_scores),
            'sleep_performance_percentage': _safe_average(sleep_performance),
            'sleep_hours_in_bed': _safe_average([
                duration / 1000 / 60 / 60 for duration in sleep_durations if duration
            ]),
        },
        'latest': {
            'recovery': scored_recoveries[0] if scored_recoveries else None,
            'cycle': scored_cycles[0] if scored_cycles else None,
            'sleep': scored_sleeps[0] if scored_sleeps else None,
        },
        'health': {
            'latest': latest_day,
            'periods': periods,
            'trend': trend,
            'recent_days': daily_rows[:14],
            'guidance': _guidance_from_summary(latest_day, periods),
        },
    }
    return summary


def _build_whoop_health_summary(integration):
    summary = (integration.metadata or {}).get('summary') or {}
    health = summary.get('health') or {}
    latest = health.get('latest') or {}
    periods = health.get('periods') or {}

    if not health:
        latest_recovery = (summary.get('latest') or {}).get('recovery') or {}
        latest_cycle = (summary.get('latest') or {}).get('cycle') or {}
        latest_sleep = (summary.get('latest') or {}).get('sleep') or {}
        recovery_score = latest_recovery.get('score', {})
        cycle_score = latest_cycle.get('score', {})
        sleep_score = latest_sleep.get('score', {})
        stages = sleep_score.get('stage_summary', {})
        latest = {
            'date': _whoop_date(latest_cycle.get('start') or latest_sleep.get('end')),
            'recovery_score': recovery_score.get('recovery_score'),
            'hrv_rmssd_milli': recovery_score.get('hrv_rmssd_milli'),
            'resting_heart_rate': recovery_score.get('resting_heart_rate'),
            'strain': cycle_score.get('strain'),
            'average_heart_rate': cycle_score.get('average_heart_rate'),
            'max_heart_rate': cycle_score.get('max_heart_rate'),
            'sleep_performance_percentage': sleep_score.get('sleep_performance_percentage'),
            'sleep_efficiency_percentage': sleep_score.get('sleep_efficiency_percentage'),
            'sleep_hours_in_bed': _duration_hours(stages.get('total_in_bed_time_milli')),
            'respiratory_rate': sleep_score.get('respiratory_rate'),
            'spo2_percentage': recovery_score.get('spo2_percentage'),
            'skin_temp_celsius': recovery_score.get('skin_temp_celsius'),
        }
        day_summary = _period_summary([latest])
        record_counts = list((summary.get('records') or {}).values())
        periods = {
            'day': day_summary,
            'week': day_summary,
            'month': {
                'days': max(record_counts) if record_counts else 0,
                'avg_recovery': (summary.get('averages') or {}).get('recovery_score'),
                'avg_hrv': (summary.get('averages') or {}).get('hrv_rmssd_milli'),
                'avg_rhr': (summary.get('averages') or {}).get('resting_heart_rate'),
                'avg_strain': (summary.get('averages') or {}).get('strain'),
                'avg_sleep_performance': (summary.get('averages') or {}).get('sleep_performance_percentage'),
                'avg_sleep_hours': (summary.get('averages') or {}).get('sleep_hours_in_bed'),
            }
        }
        health = {
            'latest': latest,
            'periods': periods,
            'trend': [],
            'recent_days': [],
            'guidance': _guidance_from_summary(latest, periods),
        }

    return {
        'connected': integration.status == 'connected',
        'status': integration.status,
        'last_sync': integration.last_sync_at,
        'sync_error': integration.sync_error,
        'account': ((integration.metadata or {}).get('profile') or {}).get('email'),
        'records': summary.get('records', {}),
        'updated_at': summary.get('updated_at'),
        **health,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Get CSRF token for the frontend.
    Sets the csrftoken cookie and returns the token value.
    """
    token = get_token(request)
    return Response({'csrfToken': token})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class HouseholdViewSet(viewsets.ModelViewSet):
    serializer_class = HouseholdSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Household.objects.filter(members=self.request.user)

    def perform_create(self, serializer):
        household = serializer.save(created_by=self.request.user)
        self.request.user.household = household
        self.request.user.save()

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        household = self.get_object()
        serializer = InviteToHouseholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']

        # Check if already invited
        existing = HouseholdInvitation.objects.filter(
            household=household,
            email=email,
            status='pending'
        ).first()
        if existing:
            return Response(
                {'error': 'Invitation already sent to this email'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create invitation
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=7)

        invitation = HouseholdInvitation.objects.create(
            household=household,
            email=email,
            invited_by=request.user,
            token=token,
            expires_at=expires_at,
        )

        # In production, send email here
        # For now, return the token so user can share it
        return Response({
            'message': f'Invitation sent to {email}',
            'invitation_id': invitation.id,
            'token': token,  # In production, don't return this - send via email
            'expires_at': expires_at,
        })

    @action(detail=True, methods=['get'])
    def invitations(self, request, pk=None):
        """List all invitations for this household."""
        household = self.get_object()
        invitations = HouseholdInvitation.objects.filter(household=household)
        return Response(HouseholdInvitationSerializer(invitations, many=True).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        request.user.household = None
        request.user.save()
        return Response({'message': 'Left household successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invitation(request):
    """Accept a household invitation using token."""
    token = request.data.get('token')
    if not token:
        return Response({'error': 'Token required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        invitation = HouseholdInvitation.objects.get(token=token, status='pending')
    except HouseholdInvitation.DoesNotExist:
        return Response({'error': 'Invalid or expired invitation'}, status=status.HTTP_404_NOT_FOUND)

    # Check if expired
    if invitation.expires_at < timezone.now():
        invitation.status = 'expired'
        invitation.save()
        return Response({'error': 'Invitation has expired'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if email matches
    if invitation.email != request.user.email:
        return Response(
            {'error': 'This invitation was sent to a different email address'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Accept invitation
    invitation.status = 'accepted'
    invitation.save()

    # Add user to household
    request.user.household = invitation.household
    request.user.save()

    return Response({
        'message': f'You have joined {invitation.household.name}',
        'household': HouseholdSerializer(invitation.household).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_invitations(request):
    """Get pending invitations for current user's email."""
    invitations = HouseholdInvitation.objects.filter(
        email=request.user.email,
        status='pending',
        expires_at__gt=timezone.now()
    )
    return Response(HouseholdInvitationSerializer(invitations, many=True).data)


class AppIntegrationViewSet(viewsets.ModelViewSet):
    serializer_class = AppIntegrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AppIntegration.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def connect(self, request, pk=None):
        """Initiate connection to a provider."""
        integration = self.get_object()

        if integration.provider == 'snoop':
            integration.status = 'pending'
            integration.sync_error = ''
            integration.metadata = {
                **(integration.metadata or {}),
                'connection_mode': 'csv_export',
                'api_available': False,
                'export_help_url': SNOOP_EXPORT_HELP_URL,
                'setup_instructions': _snoop_export_instructions(),
                'setup_started_at': timezone.now().isoformat(),
            }
            integration.save()
            return Response({
                'message': 'Snoop export connector ready',
                **_build_snoop_status(integration),
            })
        elif integration.provider == 'plaid':
            return Response({
                'message': 'Plaid connection requires Link token',
                'provider': 'plaid',
            })

        return Response({'error': 'Unknown provider'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def disconnect(self, request, pk=None):
        """Disconnect from a provider."""
        integration = self.get_object()
        integration.status = 'disconnected'
        integration.access_token = ''
        integration.refresh_token = ''
        integration.save()
        return Response({'message': f'Disconnected from {integration.provider}'})

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Manually trigger sync from provider."""
        integration = self.get_object()

        if integration.status != 'connected':
            return Response(
                {'error': 'Integration not connected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Trigger sync (in production, this would call the provider API)
        integration.last_sync_at = timezone.now()
        integration.save()

        return Response({
            'message': f'Sync started for {integration.provider}',
            'last_sync': integration.last_sync_at,
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_integrations(request):
    """Get list of available integrations and their status."""
    user = request.user

    # Get import history for Snoop
    snoop_imports = AppIntegration.objects.filter(user=user, provider='snoop').first()
    whoop = AppIntegration.objects.filter(user=user, provider='whoop').first()

    integrations = [
        {
            'provider': 'whoop',
            'name': 'Whoop',
            'description': 'Connect WHOOP to sync recovery, sleep, strain, and workout data',
            'logo': '/integrations/whoop.png',
            'features': ['OAuth connection', 'Recovery and HRV', 'Sleep performance', 'Daily strain'],
            'type': 'oauth',
            'status': whoop.status if whoop else 'disconnected',
            'last_sync': whoop.last_sync_at if whoop else None,
            'sync_error': whoop.sync_error if whoop else '',
            'is_configured': _whoop_credentials_configured(),
            'summary': whoop.metadata.get('summary') if whoop and whoop.metadata else None,
        },
        {
            'provider': 'snoop',
            'name': 'Snoop',
            'description': 'Import your transactions from Snoop app export',
            'logo': '/integrations/snoop.png',
            'features': ['CSV export connector', 'UK bank transactions', 'Duplicate-safe imports'],
            'type': 'file_upload',
            'status': snoop_imports.status if snoop_imports else 'disconnected',
            'connection_mode': 'csv_export',
            'api_configured': _snoop_api_configured(),
            'api_available': False,
            'api_note': 'Snoop does not expose a public consumer OAuth/API connection for third-party apps. Yieldly supports the official Snoop CSV export path.',
            'export_help_url': SNOOP_EXPORT_HELP_URL,
            'setup_instructions': _snoop_export_instructions(),
            'last_import': snoop_imports.last_sync_at if snoop_imports else None,
            'import_count': snoop_imports.metadata.get('total_imported', 0) if snoop_imports and snoop_imports.metadata else 0,
            'last_import_count': snoop_imports.metadata.get('last_import_count', 0) if snoop_imports and snoop_imports.metadata else 0,
            'last_import_skipped': snoop_imports.metadata.get('last_import_skipped', 0) if snoop_imports and snoop_imports.metadata else 0,
        },
        {
            'provider': 'manual',
            'name': 'Manual CSV Import',
            'description': 'Import transactions from any CSV file',
            'logo': '/integrations/csv.png',
            'features': ['CSV import', 'Custom column mapping', 'Any bank format'],
            'type': 'file_upload',
        },
    ]

    return Response(integrations)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whoop_connect(request):
    """Start the WHOOP OAuth connection flow."""
    client_id = os.environ.get('WHOOP_CLIENT_ID')
    if not client_id or not os.environ.get('WHOOP_CLIENT_SECRET'):
        return Response(
            {
                'error': 'WHOOP API credentials are not configured',
                'required_env': [
                    'WHOOP_CLIENT_ID',
                    'WHOOP_CLIENT_SECRET',
                    'WHOOP_REDIRECT_URI',
                ],
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    oauth_state = secrets.token_hex(4)
    integration, _ = AppIntegration.objects.update_or_create(
        user=request.user,
        provider='whoop',
        defaults={
            'status': 'pending',
            'sync_error': '',
        },
    )
    integration.metadata = {
        **(integration.metadata or {}),
        'oauth_state': oauth_state,
        'oauth_started_at': timezone.now().isoformat(),
    }
    integration.save()

    auth_params = {
        'client_id': client_id,
        'redirect_uri': _whoop_redirect_uri(request),
        'response_type': 'code',
        'scope': WHOOP_SCOPES,
        'state': oauth_state,
    }
    auth_url = f"{WHOOP_AUTH_URL}?{urlencode(auth_params)}"

    return Response({'auth_url': auth_url})


@api_view(['GET'])
@permission_classes([AllowAny])
def whoop_callback(request):
    """Handle WHOOP OAuth callback and store user tokens."""
    code = request.GET.get('code')
    oauth_state = request.GET.get('state')
    if not code or not oauth_state:
        return Response({'error': 'Missing WHOOP authorization code or state'}, status=status.HTTP_400_BAD_REQUEST)

    integration = AppIntegration.objects.filter(
        provider='whoop',
        metadata__oauth_state=oauth_state,
    ).first()
    if not integration:
        return Response({'error': 'Invalid WHOOP OAuth state'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        token_payload = _whoop_token_request({
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': _whoop_redirect_uri(request),
        })
    except (HTTPError, URLError, TimeoutError) as exc:
        integration.status = 'error'
        integration.sync_error = _format_whoop_error('WHOOP token exchange failed', exc)
        integration.save()
        return Response({'error': integration.sync_error}, status=status.HTTP_400_BAD_REQUEST)

    access_token = token_payload.get('access_token', '')
    refresh_token = token_payload.get('refresh_token', '')
    expires_in = token_payload.get('expires_in')

    integration.access_token = access_token
    integration.refresh_token = refresh_token
    integration.status = 'connected'
    integration.sync_error = ''
    integration.token_expires_at = (
        timezone.now() + timedelta(seconds=int(expires_in))
        if expires_in else None
    )

    try:
        profile = _whoop_request('/user/profile/basic', access_token)
        integration.external_user_id = str(profile.get('user_id') or '')
        integration.metadata = {
            **(integration.metadata or {}),
            'profile': profile,
            'oauth_state': '',
        }
    except Exception as exc:
        integration.metadata = {
            **(integration.metadata or {}),
            'profile_error': str(exc),
            'oauth_state': '',
        }

    integration.save()
    return redirect(f"{_app_base_url(request)}/integrations?whoop=connected")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whoop_sync(request):
    """Sync recent WHOOP cycles, recovery, and sleep summary into integration metadata."""
    integration = AppIntegration.objects.filter(user=request.user, provider='whoop').first()
    if not integration or integration.status != 'connected' or not integration.access_token:
        return Response({'error': 'WHOOP is not connected'}, status=status.HTTP_400_BAD_REQUEST)

    start = request.data.get('start')
    end = request.data.get('end')
    if not start:
        start = (timezone.now() - timedelta(days=60)).isoformat()
    if not end:
        end = timezone.now().isoformat()

    try:
        access_token = _whoop_access_token(integration)
        try:
            cycles = _whoop_paginated('/cycle', access_token, {'start': start, 'end': end})
            recoveries = _whoop_paginated('/recovery', access_token, {'start': start, 'end': end})
            sleeps = _whoop_paginated('/activity/sleep', access_token, {'start': start, 'end': end})
        except HTTPError as exc:
            if exc.code != 401:
                raise
            access_token = _refresh_whoop_token(integration)
            cycles = _whoop_paginated('/cycle', access_token, {'start': start, 'end': end})
            recoveries = _whoop_paginated('/recovery', access_token, {'start': start, 'end': end})
            sleeps = _whoop_paginated('/activity/sleep', access_token, {'start': start, 'end': end})
        summary = _summarize_whoop_data(cycles, recoveries, sleeps)
    except Exception as exc:
        integration.status = 'error'
        integration.sync_error = _format_whoop_error('WHOOP sync failed', exc)
        integration.save()
        return Response({'error': integration.sync_error}, status=status.HTTP_400_BAD_REQUEST)

    integration.status = 'connected'
    integration.last_sync_at = timezone.now()
    integration.sync_error = ''
    integration.metadata = {
        **(integration.metadata or {}),
        'summary': summary,
        'last_sync_range': {'start': start, 'end': end},
    }
    integration.save()

    return Response({'message': 'WHOOP sync completed', 'summary': summary})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whoop_health(request):
    """Return the latest WHOOP health summary for dashboards and agents."""
    integration = AppIntegration.objects.filter(user=request.user, provider='whoop').first()
    if not integration:
        return Response({'connected': False, 'status': 'disconnected'}, status=status.HTTP_200_OK)
    return Response(_build_whoop_health_summary(integration))


def _build_snoop_status(integration):
    metadata = integration.metadata if integration and integration.metadata else {}
    return {
        'connected': bool(integration and integration.status == 'connected'),
        'status': integration.status if integration else 'disconnected',
        'connection_mode': 'csv_export',
        'api_configured': _snoop_api_configured(),
        'api_available': False,
        'api_note': 'Snoop does not expose a public consumer OAuth/API connection for third-party apps. Yieldly supports the official Snoop CSV export path.',
        'export_help_url': SNOOP_EXPORT_HELP_URL,
        'contact_email': SNOOP_CONTACT_EMAIL,
        'setup_instructions': _snoop_export_instructions(),
        'last_import': integration.last_sync_at if integration else None,
        'total_imported': metadata.get('total_imported', 0),
        'last_import_count': metadata.get('last_import_count', 0),
        'last_import_skipped': metadata.get('last_import_skipped', 0),
        'last_accounts_created': metadata.get('last_accounts_created', []),
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def snoop_connect(request):
    """Create or update the Snoop connector setup state."""
    integration, _ = AppIntegration.objects.update_or_create(
        user=request.user,
        provider='snoop',
        defaults={
            'status': 'pending',
            'sync_error': '',
        },
    )
    integration.metadata = {
        **(integration.metadata or {}),
        'connection_mode': 'csv_export',
        'api_available': False,
        'export_help_url': SNOOP_EXPORT_HELP_URL,
        'setup_instructions': _snoop_export_instructions(),
        'setup_started_at': timezone.now().isoformat(),
    }
    integration.save()
    return Response(_build_snoop_status(integration), status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def snoop_status(request):
    """Return Snoop connector status and import history."""
    integration = AppIntegration.objects.filter(user=request.user, provider='snoop').first()
    return Response(_build_snoop_status(integration), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def snoop_import(request):
    """Import transactions from Snoop CSV export."""
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    csv_file = request.FILES['file']
    auto_create_accounts = request.data.get('auto_create_accounts', 'true').lower() == 'true'
    default_account_id = request.data.get('account_id')

    # Read and decode CSV
    try:
        decoded_file = csv_file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded_file))
        rows = list(reader)  # Read all rows to process
    except Exception as e:
        return Response({'error': f'Failed to read CSV: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    transactions_created = 0
    transactions_skipped = 0
    accounts_created = []
    errors = []

    # Account type mapping
    account_type_map = {
        'american express': 'credit',
        'virgin credit card': 'credit',
        'lloyds': 'checking',
        'monzo': 'checking',
        'starling': 'checking',
        'hsbc': 'checking',
        'barclays': 'checking',
        'natwest': 'checking',
        'santander': 'checking',
        'nationwide': 'checking',
    }

    # Build account cache - auto-create accounts from CSV if enabled
    account_cache = {}
    if auto_create_accounts:
        unique_accounts = set()
        for row in rows:
            provider = row.get('Account Provider', '').strip()
            acc_name = row.get('Account Name', '').strip()
            if provider and acc_name:
                unique_accounts.add((provider, acc_name))

        for provider, acc_name in unique_accounts:
            # Determine account type
            provider_lower = provider.lower()
            acc_type = 'checking'
            for key, val in account_type_map.items():
                if key in provider_lower:
                    acc_type = val
                    break

            # Create or get account
            full_name = f"{provider} - {acc_name}"
            try:
                account = Account.objects.filter(
                    user=request.user,
                    name=full_name,
                ).first()
                if account:
                    created = False
                else:
                    account = Account.objects.create(
                        user=request.user,
                        name=full_name,
                        type=acc_type,
                        balance=Decimal('0'),
                        currency='GBP',
                    )
                    created = True
            except Exception:
                continue
            account_cache[(provider, acc_name)] = account
            if created:
                accounts_created.append(full_name)

    # Get default account if specified
    default_account = None
    if default_account_id:
        try:
            default_account = Account.objects.get(id=default_account_id, user=request.user)
        except Account.DoesNotExist:
            pass

    # Category mapping for Snoop categories
    category_map = {}

    # Get or create categories based on Snoop's category names
    snoop_expense_categories = [
        'Eating Out', 'Groceries', 'Shopping', 'Transport', 'Entertainment',
        'Home & Family', 'Health & Beauty', 'Travel', 'Insurances', 'Childcare',
        'General', 'Business', 'Investment', 'AI-IF expenses', 'VTL T&S',
        'VTL Subscriptions', 'Internal Transfers'
    ]
    snoop_income_categories = ['Income', 'Salary', 'Internal Transfers']

    for cat_name in snoop_expense_categories:
        cat = Category.objects.filter(name=cat_name, type='expense').first()
        if not cat:
            cat = Category.objects.create(name=cat_name, type='expense', user=request.user, is_default=False)
        category_map[cat_name.lower()] = cat

    for cat_name in snoop_income_categories:
        cat = Category.objects.filter(name=cat_name, type='income').first()
        if not cat:
            cat = Category.objects.create(name=cat_name, type='income', user=request.user, is_default=False)
        category_map[f"{cat_name.lower()}_income"] = cat

    # Default categories
    default_expense_cat = category_map.get('general') or Category.objects.filter(type='expense').first()
    default_income_cat = category_map.get('income_income') or Category.objects.filter(type='income').first()

    for row_num, row in enumerate(rows, start=2):
        try:
            # Snoop CSV format columns
            date_str = row.get('Date', '').strip()
            merchant = row.get('Merchant Name', '').strip()
            description = row.get('Description', '').strip()
            amount_str = row.get('Amount', '').strip()
            category_name = row.get('Category', '').strip()
            notes = row.get('Notes', '').strip()
            provider = row.get('Account Provider', '').strip()
            acc_name = row.get('Account Name', '').strip()

            if not date_str or not amount_str:
                transactions_skipped += 1
                continue

            # Parse date
            date = None
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y']:
                try:
                    date = datetime.strptime(date_str, fmt).date()
                    break
                except ValueError:
                    continue

            if not date:
                transactions_skipped += 1
                continue

            # Parse amount
            try:
                clean_amount = amount_str.replace('£', '').replace('$', '').replace(',', '').strip()
                amount = Decimal(clean_amount)
            except (InvalidOperation, ValueError):
                transactions_skipped += 1
                continue

            # Get account
            account = account_cache.get((provider, acc_name)) or default_account
            if not account:
                transactions_skipped += 1
                continue

            # Determine transaction type and category
            if amount < 0:
                trans_type = 'expense'
                amount = abs(amount)
                category = category_map.get(category_name.lower(), default_expense_cat)
            else:
                trans_type = 'income'
                category = category_map.get(f"{category_name.lower()}_income", default_income_cat)

            # Use merchant name or description
            trans_description = merchant or description or 'Snoop Import'

            # Dedup: skip if matching transaction exists
            existing = Transaction.objects.filter(
                user=request.user,
                account=account,
                amount=amount,
                date=date,
                description=trans_description,
            ).exists()
            if existing:
                transactions_skipped += 1
                continue

            # Create transaction
            Transaction.objects.create(
                user=request.user,
                account=account,
                amount=amount,
                type=trans_type,
                description=trans_description,
                category=category,
                date=date,
                notes=notes or f"Imported from Snoop"
            )
            transactions_created += 1

            # Update account balance
            if trans_type == 'expense':
                account.balance -= amount
            else:
                account.balance += amount

        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            transactions_skipped += 1

    # Save all account balances
    for account in account_cache.values():
        account.save()
    if default_account:
        default_account.save()

    # Track import history
    integration, _ = AppIntegration.objects.update_or_create(
        user=request.user,
        provider='snoop',
        defaults={
            'status': 'connected',
            'last_sync_at': timezone.now(),
        }
    )
    current_total = integration.metadata.get('total_imported', 0) if integration.metadata else 0
    integration.metadata = {
        **(integration.metadata or {}),
        'connection_mode': 'csv_export',
        'api_available': False,
        'export_help_url': SNOOP_EXPORT_HELP_URL,
        'total_imported': current_total + transactions_created,
        'last_import_count': transactions_created,
        'last_import_skipped': transactions_skipped,
        'last_accounts_created': accounts_created,
        'last_imported_at': timezone.now().isoformat(),
    }
    integration.save()

    return Response({
        'message': 'Import completed',
        'transactions_created': transactions_created,
        'transactions_skipped': transactions_skipped,
        'accounts_created': accounts_created,
        'errors': errors[:10] if errors else [],
        'total_errors': len(errors),
    })
