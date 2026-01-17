web: cd backend && gunicorn config.wsgi --log-file -
release: cd backend && python manage.py collectstatic --noinput && python manage.py migrate
