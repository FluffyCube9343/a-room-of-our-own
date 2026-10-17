from django.contrib import admin
from .models import Tag
from apps.rooms.models import Room, RSVP
from apps.projects.models import Project, ProjectInterest
from apps.connections.models import SavedProfile
from apps.safety.models import Block, Report
from apps.accounts.models import ProfilePhoto
from apps.connections.models import Connection, ConnectionMessage, DiscoveryPass
from apps.resources.models import Resource, BorrowRequest

admin.site.site_header = 'A Room of Our Own · Community care'
admin.site.register([Tag, Room, RSVP, Project, ProjectInterest, SavedProfile, Block])
admin.site.register([ProfilePhoto, Connection, ConnectionMessage, DiscoveryPass, Resource, BorrowRequest])


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'category', 'status', 'created_at']
    list_filter = ['status', 'category']
    readonly_fields = ['reporter', 'member', 'room', 'project', 'category', 'details', 'created_at']
