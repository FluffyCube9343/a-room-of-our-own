# A Room of Our Own

**The working scaffold is implemented:** React + TypeScript frontend, Django REST backend, and a local SQLite database.

- [Setup and development commands](docs/setup.md)
- [Fictional demo accounts and walkthrough](docs/demo.md)
- [API contract](docs/api.md)
- [Verification results](docs/verification.md)
- [Implementation plan](SCAFFOLD_PLAN.md)

Run both services and open `http://127.0.0.1:5173/`. The original project concept follows.

**Project Concept & Feature Brainstorm — v0.1**

*Tagline: If we're not given a seat at the table, we'll build our own room.*

## 1. The Vision

Inspired by Virginia Woolf's *A Room of One's Own*, this platform reimagines what it means for women to have spaces of their own in technology.

The cancellation of Grace Hopper Celebration 2026, alongside growing concerns about the future of DEI initiatives and women's representation, raises a question:

**What if women in tech didn't have to depend on large institutions to create the spaces where they could be heard, supported, and empowered?**

A Room of Our Own is a women-centered, gender-inclusive digital community where people can host their own events, find mentors, discover collaborators, and build projects together.

Starting at the University of Virginia, the long-term vision is to connect women in technology across campuses and eventually around the world.

**Core philosophy:** Don't just give women access to existing spaces. Give them the tools to create their own.

## 2. The Three Core Pillars

### Pillar 1: Rooms — Create Your Own Space

A community-powered alternative to depending exclusively on traditional conferences and institutional events.

| ID | Feature | Priority |
|---|---|---|
| R1 | **Create a Room:** Host a virtual event with a title, description, topic, date, and meeting link | MVP |
| R2 | **Room Discovery:** Browse upcoming talks, workshops, panels, and community discussions | MVP |
| R3 | **RSVP & Join:** Reserve a spot and access the virtual room | MVP |
| R4 | **Mini-Conferences:** Combine multiple rooms into a conference with speakers, schedules, and tracks | Next |
| R5 | **Recurring Rooms:** Weekly coding circles, study groups, office hours, and support communities | Next |
| R6 | **Room Archives:** Save recordings, resources, and takeaways with permission | Future |

**Example:** UVA students organize an independent, Grace Hopper-inspired virtual summit featuring women engineers, alumni, panels, and networking rooms. Anyone in the community can discover and participate, even if they couldn't afford to attend a traditional conference.

### Pillar 2: Connections — Hinge-Style Mentor Matching

Make mentorship less intimidating and more personal.

| ID | Feature | Priority |
|---|---|---|
| M1 | **Personal Profiles:** Skills, interests, goals, academic year, and what you're looking for | MVP |
| M2 | **Discover Mentors:** Swipe through profiles of potential mentors or mentees | MVP |
| M3 | **Compatibility Explanations:** Show shared interests, skills, and goals that make someone a good match | MVP |
| M4 | **Mutual Matching:** Connect when both people express interest | Next |
| M5 | **Conversation Prompts:** Icebreakers such as "A challenge I'm navigating in tech..." | Next |
| M6 | **Mentorship Sessions:** Offer or request short coffee chats, resume reviews, and career advice | Next |
| M7 | **AI Matchmaking:** Personalized recommendations based on interests, goals, and experience | Future |

**Example profile prompts:**

- "I wish someone had told me..."
- "Ask me about..."
- "I'm hoping to learn..."
- "A problem in tech I want to solve is..."

Rather than matching solely by major or job title, the platform emphasizes shared experiences, aspirations, and meaningful connections.

### Pillar 3: Build Together — Find Your Dream Team

Connect women with collaborators for projects they might otherwise never start.

| ID | Feature | Priority |
|---|---|---|
| P1 | **Project Board:** Post or explore passion projects and ideas | MVP |
| P2 | **Join a Project:** Express interest in collaborating on an existing project | MVP |
| P3 | **Skill-Based Discovery:** Filter projects by topics and needed skills | Next |
| P4 | **Teammate Matching:** Find people with complementary abilities and interests | Next |
| P5 | **Project Workspaces:** Shared updates, tasks, GitHub links, and resources | Future |
| P6 | **Project Showcase:** Highlight completed projects and the women behind them | Future |

**Example:** A UVA student has an idea for an accessibility app but doesn't know anyone who can build the frontend. She posts her idea, lists the help she needs, and connects with another student excited about accessibility and UI design.

The goal is to make building a project feel collaborative and accessible, even without an established network or extensive technical experience.

## 3. The Community Layer

Features that connect all three pillars:

| ID | Feature | Priority |
|---|---|---|
| C1 | **Personalized Home:** Recommended rooms, mentors, and projects in one feed | MVP |
| C2 | **Interest Tags:** AI, cybersecurity, UX, health tech, startups, social impact, and more | MVP |
| C3 | **Community Safety:** Privacy controls, reporting, blocking, and basic host moderation | MVP |
| C4 | **Women Who Inspire:** Spotlight women founders, students, alumni, and engineers | Next |
| C5 | **Campus Communities:** Dedicated spaces for university chapters and organizations | Future |
| C6 | **Opportunity Board:** Scholarships, internships, fellowships, and conferences | Future |

## 4. Proposed Hackathon MVP

For Girls Hoo Hack 2026, the priority is to demonstrate the experience rather than build every feature.

**Must build:**
1. A welcoming landing page that explains the mission.
2. A short onboarding flow where users enter interests, skills, and goals.
3. A Rooms page where users discover, create, and RSVP to virtual events.
4. A Hinge-style mentor discovery interface with meaningful compatibility explanations.
5. A Project Board where users post ideas and express interest in joining.

**Stretch goals:** Mutual matching, inbox messaging, personalized room recommendations, and mini-conference schedules.

**Out of scope for this weekend:** Building a video-conferencing system, complex AI infrastructure, and fully featured project-management tools. External meeting links and seeded demo profiles are enough to demonstrate the product.

The strongest interaction would connect multiple pillars: someone attends a room, discovers a mentor, and finds a project to join.

## 5. Example User Journey

Meet Maya, a first-year UVA student interested in AI who hasn't yet found a community in tech.

1. Maya signs up and chooses interests like AI, social impact, and frontend development.
2. On her homepage, she discovers a virtual room called "Women Building with AI."
3. She RSVPs and joins the discussion.
4. Afterward, she explores mentor profiles and connects with a fourth-year student interested in similar work.
5. She discovers a student-led project developing an AI accessibility tool and requests to join.
6. Maya goes from feeling disconnected to having a mentor, a project team, and a community.

**The transformation:** From feeling like an outsider in tech to having a space, a voice, and people to build with.

## 6. What Makes This Different?

This isn't just LinkedIn, Discord, or another event platform.

Most platforms solve one problem at a time: networking, event hosting, or recruiting teammates.

A Room of Our Own connects all three around a common purpose: building an enduring, community-owned ecosystem that supports women in technology.

The rooms aren't merely video calls. They're the entry point to relationships, collaboration, and opportunity.

## 7. Measuring Impact

Beyond user sign-ups, we'd measure:

- Rooms created and events attended.
- Mentorship connections initiated and accepted.
- Project collaboration requests and teams formed.
- People returning to host another event or help someone else.
- New opportunities participants say they found through the community.

## 8. Hackathon Positioning

**Primary track: Best Female Empowerment**

Directly supports women in STEM by strengthening access to community, mentorship, and technical collaboration.

**Additional tracks to consider:**
- Best Overall — creative concept, social relevance, and innovation.
- Best Live Demo — an emotionally compelling, interactive journey across the product.

**Three-minute demo story:**

Start with the cancellation of a major gathering for women in computing. Introduce the Virginia Woolf inspiration. Show a student creating a room, finding a mentor, and joining a project. End with the idea that a room created at UVA could eventually connect women around the world.

## 9. Longer-Term Vision

UVA is the starting point, not the limit.

Imagine universities, student organizations, alumni groups, and women in tech communities hosting their own independent conferences, mentorship networks, and collaborative projects through one platform.

A Room of Our Own could become an infrastructure for community-led opportunity, one that doesn't disappear when a single conference is canceled or an institution changes its priorities.

**The ultimate vision: Every woman in tech should have access to a room of her own — and the power to open its doors to others.**

---

*Status: Initial brainstorm. Feature priorities and product direction are open for feedback.*

