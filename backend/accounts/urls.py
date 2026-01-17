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
    snoop_import,
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
    path('snoop/import/', snoop_import, name='snoop-import'),
    path('', include(router.urls)),
]
