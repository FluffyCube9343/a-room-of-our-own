from io import BytesIO
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from PIL import Image
from apps.accounts.models import User
from apps.community.models import Tag
from apps.rooms.models import Room, RSVP, RoomCollaborator
from apps.safety.models import Block


@override_settings(STORAGES={'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'}, 'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}})
class RoomCoversChatTests(TestCase):
    def setUp(self):
        cache.clear()
        self.host = User.objects.create_user('coverhost@example.com', 'password')
        self.member = User.objects.create_user('covermember@example.com', 'password')
        self.room = Room.objects.create(host=self.host, title='Chat', format='chatroom', description='Talk together')
        self.client = APIClient()
        self.client.force_login(self.host)
        self.path = f'/api/v1/rooms/{self.room.id}/'

    def photo(self):
        stream = BytesIO()
        Image.new('RGB', (640, 360), 'blue').save(stream, format='PNG')
        return SimpleUploadedFile('cover.png', stream.getvalue(), content_type='image/png')

    def test_upload_create_edit_remove_and_visibility(self):
        tag = Tag.objects.create(slug='python', label='Python')
        response = self.client.post('/api/v1/rooms/', {'title': 'Python chat', 'description': 'Talk about Python', 'format': 'chatroom', 'tags': [tag.id], 'cover_image': self.photo()}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNotNone(response.data['cover_url'])
        response = self.client.patch(self.path, {'cover_image': self.photo()}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        cover = response.data['cover_url']
        image = self.client.get(cover)
        self.assertEqual(image.status_code, 200)
        self.assertEqual(Image.open(BytesIO(b''.join(image.streaming_content))).format, 'JPEG')
        self.client.force_login(self.member)
        self.assertEqual(self.client.get(cover).status_code, 200)
        self.assertEqual(self.client.patch(self.path, {'cover_image': self.photo()}, format='multipart').status_code, 403)
        Block.objects.create(blocker=self.member, blocked=self.host)
        self.assertEqual(self.client.get(cover).status_code, 404)
        self.client.force_login(self.host)
        self.assertIsNone(self.client.patch(self.path, {'cover_image': None}, format='json').data['cover_url'])
        self.assertEqual(self.client.get(cover).status_code, 404)

    def test_invalid_upload_and_collaborator_upload(self):
        bad = SimpleUploadedFile('photo.jpg', b'not an image', content_type='image/jpeg')
        self.assertEqual(self.client.patch(self.path, {'cover_image': bad}, format='multipart').status_code, 400)
        RoomCollaborator.objects.create(room=self.room, user=self.member, status='approved')
        self.client.force_login(self.member)
        self.assertEqual(self.client.patch(self.path, {'cover_image': self.photo()}, format='multipart').status_code, 200)

    def test_chat_cursor_no_gaps_and_stable_history(self):
        RSVP.objects.create(room=self.room, user=self.member)
        records = [self.room.messages.create(sender=self.host, body=f'Message {i}') for i in range(30)]
        path = self.path + 'messages/'
        self.client.force_login(self.member)
        initial = self.client.get(path).data
        self.assertEqual(len(initial['results']), 24)
        oldest = initial['results'][-1]['id']
        self.room.messages.create(sender=self.host, body='New message')
        earlier = self.client.get(path, {'before': oldest}).data['results']
        self.assertEqual(len(earlier), 6)
        self.assertFalse({m['id'] for m in earlier} & {m['id'] for m in initial['results']})
        incoming = self.client.get(path, {'after': records[-1].id}).data['results']
        self.assertEqual([m['body'] for m in incoming], ['New message'])
        self.assertEqual(self.client.get(path, {'after': 'oops'}).status_code, 400)

    def test_channel_replies_edit_delete_and_permissions(self):
        RSVP.objects.create(room=self.room, user=self.member)
        path = self.path + 'messages/'
        first = self.client.post(path, {'body': 'Original'}, format='json').data
        self.client.force_login(self.member)
        reply = self.client.post(path, {'body': 'Reply', 'reply_to_id': first['id']}, format='json')
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data['reply']['body'], 'Original')
        detail = path + str(first['id']) + '/'
        self.assertEqual(self.client.patch(detail, {'body': 'Stolen'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(detail).status_code, 403)
        other = Room.objects.create(host=self.host, title='Other', format='chatroom')
        foreign = other.messages.create(sender=self.host, body='Private')
        self.assertEqual(self.client.post(path, {'body': 'No', 'reply_to_id': foreign.id}, format='json').status_code, 404)
        self.client.force_login(self.host)
        edited = self.client.patch(detail, {'body': 'Edited'}, format='json')
        self.assertEqual(edited.status_code, 200)
        self.assertIsNotNone(edited.data['edited_at'])
        synced = self.client.get(path, {'ids': str(first['id'])}).data['results']
        self.assertEqual(synced[0]['body'], 'Edited')
        self.assertEqual(self.client.delete(detail).status_code, 204)
        rows = self.client.get(path).data['results']
        self.assertIsNone(rows[0]['reply'])
        self.assertEqual(rows[1]['body'], '')
        self.assertIsNotNone(rows[1]['deleted_at'])
        self.assertEqual(self.client.get(self.path + 'members/').data['count'], 2)
        RSVP.objects.filter(room=self.room, user=self.member).update(status='removed')
        self.client.force_login(self.member)
        self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.get(self.path + 'members/').status_code, 403)
