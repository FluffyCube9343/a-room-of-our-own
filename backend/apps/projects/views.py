from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from apps.community.services import visible_projects


class ProjectCover(APIView):
    def get(self, request, pk):
        project = get_object_or_404(visible_projects(request.user), pk=pk)
        if not project.cover_image:
            raise Http404
        try:
            response = FileResponse(project.cover_image.open('rb'), content_type='image/jpeg')
        except FileNotFoundError:
            raise Http404
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
