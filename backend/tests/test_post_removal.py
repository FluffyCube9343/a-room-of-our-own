from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.projects.models import Project, ProjectInterest
from apps.resources.models import Resource, BorrowRequest
from apps.rooms.models import Room, RSVP, RoomCollaborator, RoomMessage


class PostRemovalTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('post-owner@example.com', 'Community!42')
        cls.member = User.objects.create_user('post-member@example.com', 'Community!42')

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.owner)
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        override = override_settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)

    def add_cover(self, post):
        image = BytesIO()
        Image.new('RGB', (50, 40), '#336699').save(image, 'JPEG')
        post.cover_image.save('cover.jpg', SimpleUploadedFile('cover.jpg', image.getvalue(), content_type='image/jpeg'))
        return post.cover_image.storage, post.cover_image.name

    def test_room_host_only_deletion_including_chat_rsvps_collaborators_and_cover(self):
        room = Room.objects.create(host=self.owner, title='A room', description='A chat', format='chatroom')
        storage, name = self.add_cover(room)
        RSVP.objects.create(room=room, user=self.member)
        RoomCollaborator.objects.create(room=room, user=self.member, status='approved')
        message = RoomMessage.objects.create(room=room, sender=self.member, body='Hello')
        path = f'/api/v1/rooms/{room.id}/'
        self.client.force_login(self.member)
        self.assertTrue(self.client.get(path).data['can_edit'])
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.assertTrue(Room.objects.filter(pk=room.id).exists())
        self.client.logout()
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.client.force_login(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertFalse(storage.exists(name))
        self.assertFalse(Room.objects.filter(pk=room.id).exists())
        self.assertFalse(RoomMessage.objects.filter(pk=message.id).exists())
        self.assertFalse(RSVP.objects.filter(room_id=room.id).exists())
        self.assertFalse(RoomCollaborator.objects.filter(room_id=room.id).exists())
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.delete(path).status_code, 404)
        self.assertEqual(self.client.get(path + 'messages/').status_code, 404)
        self.assertEqual(self.client.get('/api/v1/rooms/').data['count'], 0)

    def test_project_owner_only_deletion_preserves_resource_borrowing(self):
        project = Project.objects.create(owner=self.owner, title='Build together', description='A project')
        storage, name = self.add_cover(project)
        interest = ProjectInterest.objects.create(project=project, requester=self.member)
        resource = Resource.objects.create(owner=self.member, title='A tool', description='A useful tool', category='tools', condition='Good', location='Library')
        today = timezone.localdate()
        borrowing = BorrowRequest.objects.create(resource=resource, borrower=self.owner, project=project,
            start_date=today, end_date=today + timedelta(days=1), status='approved')
        path = f'/api/v1/projects/{project.id}/'
        self.client.force_login(self.member)
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.assertTrue(Project.objects.filter(pk=project.id).exists())
        self.client.logout()
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.client.force_login(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertFalse(storage.exists(name))
        self.assertFalse(Project.objects.filter(pk=project.id).exists())
        self.assertFalse(ProjectInterest.objects.filter(pk=interest.id).exists())
        borrowing.refresh_from_db()
        self.assertIsNone(borrowing.project_id)
        self.assertEqual(borrowing.status, 'approved')
        self.assertTrue(Resource.objects.filter(pk=resource.id).exists())
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.delete(path).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/projects/').data['count'], 0)
