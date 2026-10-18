from django.http import HttpResponse


class HealthCheckMiddleware:
    # The ALB health check carries no usable Host header, so this answers
    # before Django's ALLOWED_HOSTS validation can reject it.
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/healthz/':
            return HttpResponse('ok', content_type='text/plain')
        return self.get_response(request)
