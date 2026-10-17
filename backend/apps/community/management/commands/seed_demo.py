from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from apps.accounts.models import User, ProfilePrompt
from apps.community.models import Tag
from apps.rooms.models import Room, RSVP
from apps.projects.models import Project


class Command(BaseCommand):
    help = 'Create/update fictional local demo content. Never runs outside DEBUG.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo seeding is only available with DJANGO_DEBUG=1.')
        labels = ['AI', 'Accessibility', 'Social impact', 'Frontend', 'Python', 'UX design', 'Cybersecurity', 'Startups', 'Health tech', 'Data science']
        tags = {label: Tag.objects.get_or_create(slug=slugify(label), defaults={'label': label})[0] for label in labels}
        people = [
            ('Maya Chen', 'First-year · Computer science', 'learn', ['AI', 'Social impact', 'Frontend'], ['Frontend'], 'Find a little courage, a mentor, and a project that makes a difference.', 'Building things before you feel ready is how you get ready.'),
            ('Priya Sharma', 'Fourth-year · Computer science', 'both', ['AI', 'Accessibility', 'Social impact'], ['Python', 'AI'], 'Help more women find their footing in tech.', 'Turning a messy idea into your first machine learning project. No question is too small.'),
            ('Zoe Williams', 'UVA alum · Product designer', 'mentor', ['UX design', 'Accessibility'], ['UX design', 'Frontend'], 'Make thoughtful design feel accessible to everyone.', 'Your perspective is a skill. You do not have to sound like everyone else.'),
            ('Amara Okafor', 'Third-year · Computer science', 'both', ['Cybersecurity', 'Social impact'], ['Cybersecurity', 'Python'], 'Build safer communities online.', 'Finding your first security internship and learning by breaking things (ethically!).'),
            ('Sofia Reyes', 'Second-year · Data science', 'both', ['Health tech', 'AI'], ['Python', 'Data science'], 'Use data to make healthcare kinder.', 'The little projects that helped me stop feeling like an imposter.'),
            ('Lily Park', 'UVA alum · Software engineer', 'mentor', ['Frontend', 'Accessibility'], ['Frontend', 'UX design'], 'Support students building their first real app.', 'React, accessible interfaces, and what the first year at work actually feels like.'),
            ('Nadia Hassan', 'Graduate student · Engineering', 'mentor', ['Startups', 'Social impact'], ['Python', 'AI'], 'Turn research into useful things with a curious team.', 'You are allowed to change direction. Curiosity is a good enough starting point.'),
            ('Emma Brooks', 'Third-year · Cognitive science', 'both', ['UX design', 'Health tech'], ['UX design', 'Data science'], 'Find collaborators who care about people.', 'User research with a tiny budget and a lot of empathy.'),
            ('Iris Nguyen', 'Second-year · Computer science', 'learn', ['AI', 'Frontend'], ['Python'], 'Learn by building with a welcoming team.', 'How to bring a small idea all the way to a finished project.'),
        ]
        users = []
        for index, (name, role, intent, interests, skills, goals, answer) in enumerate(people):
            email = name.split()[0].lower() + '@room.demo'
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(email, 'RoomDemo!2026')
            profile = user.profile
            profile.display_name, profile.role, profile.intent = name, role, intent
            profile.bio = 'Curious about technology. Here for meaningful conversations and building things with good people.'
            profile.goals, profile.onboarding_complete = goals, True
            profile.save()
            profile.interests.set([tags[x] for x in interests])
            profile.skills.set([tags[x] for x in skills])
            profile.learning.set([tags['Python'], tags['AI']] if index == 0 else [tags[interests[0]]])
            ProfilePrompt.objects.update_or_create(profile=profile, key='ask', defaults={'answer': answer, 'order': 0})
            ProfilePrompt.objects.update_or_create(profile=profile, key='wish', defaults={'answer': 'You do not have to have it all figured out to belong here.', 'order': 1})
            users.append(user)
        room_data = [
            ('Women Building with AI', 'A gentle introduction to building with AI, and an honest conversation about where to start. Bring an idea, a question, or just your curiosity.', 'conversation', ['AI', 'Social impact']),
            ('Your first portfolio, together', 'Bring the project you are proud of. We will turn it into a portfolio story, share useful feedback, and make progress together.', 'workshop', ['UX design', 'Frontend']),
            ('A softer landing in cybersecurity', 'An open conversation about finding your path into security, from first CTFs to internships. All experience levels are welcome.', 'panel', ['Cybersecurity', 'Python']),
            ('Coffee, code & a little company', 'A quiet co-working hour for whatever you are working on. Start with a quick hello, then settle in with your favorite drink.', 'coworking', ['Frontend', 'Social impact']),
            ('Designing for everyone', 'Explore small accessibility decisions that make a big difference. We will walk through examples and learn from each other.', 'workshop', ['Accessibility', 'UX design']),
            ('Small ideas, real impact', 'Meet students exploring health tech and social good. Share a rough idea and find someone who wants to help you build it.', 'conversation', ['Health tech', 'Startups']),
        ]
        for index, (title, description, format_name, topics) in enumerate(room_data):
            start = (timezone.now() + timedelta(days=index + 1)).replace(hour=21, minute=0, second=0, microsecond=0)
            room, _ = Room.objects.update_or_create(host=users[index + 1], title=title, defaults={
                'description': description, 'format': format_name, 'starts_at': start, 'ends_at': start + timedelta(hours=1),
                'meeting_url': 'https://example.com/demo-room', 'status': 'scheduled'})
            room.tags.set([tags[t] for t in topics])
            for attendee in users[7:]:
                if attendee != room.host:
                    RSVP.objects.get_or_create(room=room, user=attendee)
        project_data = [
            ('A more accessible campus', 'Help us build an AI-powered guide to accessible spaces at UVA. We are starting small: clear information, thoughtful design, and a map that works for everyone.', ['Accessibility', 'AI'], ['Frontend', 'UX design']),
            ('The little wellness check-in', 'A private, gentle space to notice how you are doing. Looking for people who care about making health tech feel human.', ['Health tech', 'Social impact'], ['Frontend', 'Python']),
            ('Decode the internship search', 'An open resource that makes the first internship search a little less overwhelming. Help organize advice and build the interface.', ['Social impact', 'Frontend'], ['UX design', 'Frontend']),
            ('Safer spaces online', 'A beginner-friendly toolkit for student organizations to improve digital security, one practical step at a time.', ['Cybersecurity', 'Social impact'], ['Python', 'Cybersecurity']),
            ('Data for a greener tomorrow', 'Explore campus sustainability data and turn it into useful, accessible stories. Curious beginners welcome.', ['Data science', 'Social impact'], ['Python', 'UX design']),
            ('Ideas after office hours', 'A tiny idea-sharing board for students who want to build something but have not found their people yet.', ['Startups', 'Frontend'], ['Frontend', 'UX design']),
        ]
        for index, (title, description, topics, needed) in enumerate(project_data):
            project, _ = Project.objects.update_or_create(owner=users[index + 1], title=title, defaults={'description': description, 'status': 'open'})
            project.tags.set([tags[t] for t in topics])
            project.needed_skills.set([tags[t] for t in needed])
        self.stdout.write(self.style.SUCCESS('Fictional demo ready: 9 members, 6 rooms, 6 projects. See docs/demo.md for local credentials.'))
