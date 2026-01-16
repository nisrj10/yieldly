from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model for Yiedly - supports family finance sharing."""
    email = models.EmailField(unique=True)

    # Family/household linking
    household = models.ForeignKey(
        'Household',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members'
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name']

    def __str__(self):
        return self.email


class Household(models.Model):
    """Represents a family/household for shared finances."""
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_households'
    )

    def __str__(self):
        return self.name


class HouseholdInvitation(models.Model):
    """Invitations to join a household."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    email = models.EmailField()
    invited_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sent_invitations'
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"Invitation to {self.email} for {self.household.name}"


class AppIntegration(models.Model):
    """Third-party app integrations (Snoop, Plaid, etc.)."""
    PROVIDER_CHOICES = [
        ('snoop', 'Snoop'),
        ('plaid', 'Plaid'),
        ('truelayer', 'TrueLayer'),
        ('manual', 'Manual Import'),
    ]
    STATUS_CHOICES = [
        ('connected', 'Connected'),
        ('disconnected', 'Disconnected'),
        ('error', 'Error'),
        ('pending', 'Pending'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='integrations'
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='disconnected')
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    external_user_id = models.CharField(max_length=255, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    sync_error = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'provider']

    def __str__(self):
        return f"{self.user.email} - {self.provider}"
