from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    UserProfileView,
    HouseholdViewSet,
    AppIntegrationViewSet,
    accept_invitation,
    pending_invitations,
    available_integrations,
    whoop_callback,
    whoop_connect,
    whoop_health,
    whoop_sync,
    snoop_connect,
    snoop_import,
    snoop_status,
    get_csrf_token,
)

router = DefaultRouter()
router.register('households', HouseholdViewSet, basename='household')
router.register('integrations', AppIntegrationViewSet, basename='integration')

urlpatterns = [
    path('csrf/', get_csrf_token, name='csrf_token'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('me/', UserProfileView.as_view(), name='me'),  # Alias for profile
    path('accept-invitation/', accept_invitation, name='accept-invitation'),
    path('pending-invitations/', pending_invitations, name='pending-invitations'),
    path('available-integrations/', available_integrations, name='available-integrations'),
    path('whoop/connect/', whoop_connect, name='whoop-connect'),
    path('whoop/callback/', whoop_callback, name='whoop-callback'),
    path('whoop/sync/', whoop_sync, name='whoop-sync'),
    path('whoop/health/', whoop_health, name='whoop-health'),
    path('snoop/connect/', snoop_connect, name='snoop-connect'),
    path('snoop/status/', snoop_status, name='snoop-status'),
    path('snoop/import/', snoop_import, name='snoop-import'),
    path('', include(router.urls)),
]
