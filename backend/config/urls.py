from django.contrib import admin
from django.urls import path, include
from apps.community import views as v
from apps.accounts import views as profiles
from apps.connections import views as connections
from apps.resources import views as resources
from apps.rooms import views as rooms

api = [
    path('account/', profiles.AccountDetail.as_view()),
    path('rooms/similar/', rooms.SimilarRooms.as_view()),
    path('rooms/<int:pk>/cover/', rooms.RoomCover.as_view()),
    path('rooms/<int:pk>/messages/', rooms.RoomMessages.as_view()),
    path('rooms/<int:pk>/messages/<int:message_id>/', rooms.RoomMessageDetail.as_view()),
    path('rooms/<int:pk>/members/', rooms.RoomMembers.as_view()),
    path('rooms/<int:pk>/collaborators/', rooms.Collaborators.as_view()),
    path('profile/prompt-options/', profiles.PromptOptions.as_view()),
    path('profile/photos/', profiles.PhotoUpload.as_view()),
    path('profile/photos/order/', profiles.PhotoOrder.as_view()),
    path('profile/photos/<int:pk>/', profiles.PhotoDetail.as_view()),
    path('profile/photos/<int:pk>/image/', profiles.PhotoImage.as_view()),
    path('discover/', connections.DiscoverView.as_view()),
    path('discover/passes/', connections.ResetPasses.as_view()),
    path('discover/passes/<int:pk>/', connections.PassView.as_view()),
    path('connections/', connections.ConnectionsView.as_view()),
    path('connections/<int:pk>/', connections.ConnectionDetail.as_view()),
    path('connections/<int:pk>/messages/', connections.MessagesView.as_view()),
    path('resources/', resources.ResourceList.as_view()),
    path('impact/', resources.ImpactView.as_view()),
    path('resources/<int:pk>/', resources.ResourceDetail.as_view()),
    path('resources/<int:pk>/requests/', resources.BorrowCreate.as_view()),
    path('borrow-requests/', resources.BorrowList.as_view()),
    path('borrow-requests/<int:pk>/', resources.BorrowUpdate.as_view()),
    path('auth/csrf/', v.CsrfView.as_view()), path('auth/me/', v.MeView.as_view()),
    path('auth/<str:action>/', v.AuthView.as_view()), path('profile/', v.ProfileView.as_view()),
    path('tags/', v.TagsView.as_view()), path('home/', v.HomeView.as_view()),
    path('rooms/', v.RoomList.as_view()), path('rooms/<int:pk>/', v.RoomDetail.as_view()),
    path('rooms/<int:pk>/rsvp/', v.RSVPView.as_view()),
    path('rooms/<int:pk>/attendees/', v.AttendeesView.as_view()),
    path('rooms/<int:pk>/attendees/<int:user_id>/', v.AttendeesView.as_view()),
    path('mentors/', v.MentorList.as_view()), path('members/<int:pk>/', v.MemberDetail.as_view()),
    path('saved-profiles/', v.SavedProfilesView.as_view()), path('saved-profiles/<int:pk>/', v.SavedProfilesView.as_view()),
    path('projects/', v.ProjectList.as_view()), path('projects/<int:pk>/', v.ProjectDetail.as_view()),
    path('projects/<int:pk>/interest/', v.ProjectInterestView.as_view()),
    path('projects/<int:pk>/interests/', v.ProjectRequestsView.as_view()),
    path('reports/', v.ReportsView.as_view()), path('blocks/', v.BlocksView.as_view()),
    path('blocks/<int:pk>/', v.BlocksView.as_view()),
]
# Built React app is a single-page app: unknown non-API paths get index.html.
from pathlib import Path
from django.conf import settings as djsettings
from django.http import HttpResponse, Http404
from django.urls import re_path
from django.views.decorators.http import require_GET


@require_GET
def spa(request):
    index = Path(djsettings.BASE_DIR).parent / 'frontend' / 'dist' / 'index.html'
    if not index.exists():
        raise Http404
    return HttpResponse(index.read_text(), content_type='text/html')


urlpatterns = [path('admin/', admin.site.urls), path('api/v1/', include(api)),
               re_path(r'^(?!admin/|api/).*$', spa)]
