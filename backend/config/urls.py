from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.http import HttpResponse
import os

def serve_frontend(request):
    """Serve the React frontend's index.html for client-side routing."""
    index_path = settings.FRONTEND_DIR / 'index.html'
    if index_path.exists():
        with open(index_path, 'r') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return HttpResponse('Frontend not built. Run npm run build in frontend directory.', status=404)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('finance.urls')),
]

# In production, serve the React frontend for all non-API routes
if not settings.DEBUG:
    urlpatterns += [
        re_path(r'^(?!api/|admin/|static/).*$', serve_frontend),
    ]
