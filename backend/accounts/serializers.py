from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Household, HouseholdInvitation, AppIntegration

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'household']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name', 'password', 'password_confirm']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match"})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class HouseholdSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = Household
        fields = ['id', 'name', 'created_at', 'created_by', 'members']
        read_only_fields = ['id', 'created_at', 'created_by']


class InviteToHouseholdSerializer(serializers.Serializer):
    email = serializers.EmailField()


class HouseholdInvitationSerializer(serializers.ModelSerializer):
    household_name = serializers.CharField(source='household.name', read_only=True)
    invited_by_name = serializers.CharField(source='invited_by.first_name', read_only=True)
    invited_by_email = serializers.CharField(source='invited_by.email', read_only=True)

    class Meta:
        model = HouseholdInvitation
        fields = [
            'id', 'household', 'household_name', 'email',
            'invited_by', 'invited_by_name', 'invited_by_email',
            'status', 'token', 'created_at', 'expires_at'
        ]
        read_only_fields = ['id', 'token', 'created_at', 'invited_by']


class AppIntegrationSerializer(serializers.ModelSerializer):
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AppIntegration
        fields = [
            'id', 'provider', 'provider_display', 'status', 'status_display',
            'last_sync_at', 'sync_error', 'metadata', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_sync_at']
        extra_kwargs = {
            'access_token': {'write_only': True},
            'refresh_token': {'write_only': True},
        }


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField()
