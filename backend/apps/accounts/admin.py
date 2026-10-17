from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Profile, ProfilePrompt


@admin.register(User)
class AccountAdmin(UserAdmin):
    ordering = ['email']
    list_display = ['email', 'is_active', 'is_staff']
    search_fields = ['email']
    fieldsets = ((None, {'fields': ('email', 'password')}), ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}))
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('email', 'password1', 'password2')}),)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        Profile.objects.get_or_create(user=obj, defaults={'display_name': obj.email.split('@')[0]})


admin.site.register(Profile)
admin.site.register(ProfilePrompt)
