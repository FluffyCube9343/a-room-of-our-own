"""Small, explainable matches; no private profile data goes to external services."""
import re

INTEREST_TERMS = {
    'ai': {'raspberry', 'camera', 'gpu', 'sensor'},
    'python': {'raspberry', 'micropython', 'computing'},
    'data-science': {'sensor', 'raspberry', 'computing'},
    'accessibility': {'button', 'sensor', 'microcontroller'},
    'health-tech': {'sensor', 'wearable', 'arduino'},
    'cybersecurity': {'raspberry', 'network', 'router'},
    'ux-design': {'prototype', 'prototyping', 'materials'},
    'frontend': {'monitor', 'computing'},
    'robotics': {'motor', 'arduino', 'sensor', 'microcontroller'},
    'hardware': {'electronics', 'tools', 'computing', 'materials'},
}
HARDWARE_TERMS = {'arduino', 'raspberry', 'sensor', 'sensors', 'motor', 'motors', 'robot', 'robotics', 'microcontroller', 'circuit', 'circuits', 'electronics', 'hardware', 'soldering', 'breadboard', 'wearable', 'iot', 'esp32'}


def words(text):
    return set(re.findall(r'[a-z0-9]+', text.lower()))


def interest_matches(resource, tags):
    text = words(f'{resource.title} {resource.description} {resource.category}')
    text |= {word[:-1] for word in text if len(word) > 3 and word.endswith('s')}
    return [tag.label for tag in tags if
            words(tag.label) <= text or text & INTEREST_TERMS.get(tag.slug, set())]


def hardware_project(project):
    return project.is_hardware or bool(words(f'{project.title} {project.description}') & HARDWARE_TERMS)


def project_match(resource, project):
    shared = words(f'{resource.title} {resource.description}') & words(f'{project.title} {project.description}') & (HARDWARE_TERMS - {'hardware', 'electronics'})
    if shared:
        return len(shared) + 1, 'Matches your project: ' + ', '.join(sorted(shared))
    if resource.category in {'electronics', 'tools', 'computing', 'materials'}:
        return 1, 'A hardware starting point — check suitability for your build'
    return 0, ''
