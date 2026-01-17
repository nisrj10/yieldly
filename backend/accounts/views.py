from rest_framework import generics, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from datetime import timedelta, datetime
import secrets
import csv
import io
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
            # Snoop API connection flow
            # In production, this would redirect to Snoop OAuth
            return Response({
                'message': 'Snoop connection initiated',
                'auth_url': 'https://app.snoop.com/connect',  # Placeholder
                'instructions': 'Follow the link to connect your Snoop account',
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

    integrations = [
        {
            'provider': 'snoop',
            'name': 'Snoop',
            'description': 'Import your transactions from Snoop app export (CSV)',
            'logo': '/integrations/snoop.png',
            'features': ['Monthly CSV import', 'UK bank transactions', 'Easy export from Snoop app'],
            'type': 'file_upload',
            'last_import': snoop_imports.last_sync_at if snoop_imports else None,
            'import_count': snoop_imports.metadata.get('total_imported', 0) if snoop_imports and snoop_imports.metadata else 0,
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
            account, created = Account.objects.get_or_create(
                user=request.user,
                name=full_name,
                defaults={
                    'type': acc_type,
                    'balance': Decimal('0'),
                    'currency': 'GBP',
                }
            )
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
        cat, _ = Category.objects.get_or_create(
            name=cat_name,
            type='expense',
            defaults={'user': request.user, 'is_default': False}
        )
        category_map[cat_name.lower()] = cat

    for cat_name in snoop_income_categories:
        cat, _ = Category.objects.get_or_create(
            name=cat_name,
            type='income',
            defaults={'user': request.user, 'is_default': False}
        )
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
        'total_imported': current_total + transactions_created,
        'last_import_count': transactions_created,
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
