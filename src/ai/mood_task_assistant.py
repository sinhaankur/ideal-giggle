"""
Mood-Aware Task Assistant - Intelligent Daily Task Recommendations
Analyzes user mood and provides context-aware task suggestions
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum


class TaskCategory(Enum):
    """Task categories based on mood and energy"""
    PRODUCTIVE = "productive"  # High focus, creative, challenging
    THERAPEUTIC = "therapeutic"  # Emotional processing, self-care
    ENERGIZING = "energizing"  # Physical activity, engagement
    CALMING = "calming"  # Peaceful, meditation, reflection
    SOCIAL = "social"  # Collaboration, communication
    LEARNING = "learning"  # Knowledge acquisition, skill building


class MoodLevel(Enum):
    """Mood intensity levels"""
    VERY_LOW = "very_low"
    LOW = "low"
    MEDIUM = "medium"
    NEUTRAL = "neutral"
    HIGH = "high"
    VERY_HIGH = "very_high"


@dataclass
class Task:
    """Represents a task recommendation"""
    title: str
    description: str
    category: TaskCategory
    priority: str  # 'critical', 'high', 'medium', 'low'
    estimated_time: int  # in minutes
    energy_required: str  # 'low', 'medium', 'high'
    mood_match: float  # 0-1, how well it matches current mood
    emoji: str
    why_now: str  # Explanation of why this fits the mood
    steps: List[str]


@dataclass
class TaskRecommendation:
    """Complete task recommendation set"""
    mood: str
    mood_level: MoodLevel
    confidence: float
    tasks: List[Task]
    wellbeing_tip: str
    affirmation: str
    next_actions: List[str]
    suggested_break_time: int  # in minutes


class MoodTaskMatcher:
    """Intelligent mood-to-task mapping system"""

    def __init__(self):
        self.mood_profiles = self._initialize_mood_profiles()

    def _initialize_mood_profiles(self) -> Dict:
        """Initialize mood-specific task databases"""
        return {
            'happy': {
                'level': MoodLevel.VERY_HIGH,
                'energy': 'high',
                'focus': 'creative',
                'productivity': 95,
                'social': True,
                'tasks': [
                    Task(
                        title='Start New Project',
                        description='Begin that exciting project you\'ve been thinking about',
                        category=TaskCategory.PRODUCTIVE,
                        priority='high',
                        estimated_time=120,
                        energy_required='high',
                        mood_match=0.95,
                        emoji='🚀',
                        why_now='Your positive energy is perfect for tackling something ambitious',
                        steps=[
                            'Outline your vision',
                            'Break into milestones',
                            'Set up your workspace',
                            'Start with first milestone'
                        ]
                    ),
                    Task(
                        title='Collaborate & Help Others',
                        description='Your positive energy spreads - work with teammates or help a friend',
                        category=TaskCategory.SOCIAL,
                        priority='high',
                        estimated_time=60,
                        energy_required='high',
                        mood_match=0.90,
                        emoji='🤝',
                        why_now='Your mood is contagious and uplifting for others',
                        steps=[
                            'Identify someone who needs help',
                            'Reach out with enthusiasm',
                            'Pair program or brainstorm',
                            'Share knowledge generously'
                        ]
                    ),
                    Task(
                        title='Tackle Challenge Tasks',
                        description='Now\'s the time for those difficult problems you\'ve been avoiding',
                        category=TaskCategory.PRODUCTIVE,
                        priority='high',
                        estimated_time=90,
                        energy_required='high',
                        mood_match=0.88,
                        emoji='💪',
                        why_now='Peak energy and confidence make tough problems solvable',
                        steps=[
                            'List challenging tasks',
                            'Pick the most rewarding one',
                            'Break problem into parts',
                            'Solve systematically'
                        ]
                    ),
                ],
                'wellbeing_tip': 'Channel this amazing energy into meaningful work. You can accomplish more today!',
                'affirmation': 'You are capable of great things, and your positive energy inspires others.'
            },
            'sad': {
                'level': MoodLevel.LOW,
                'energy': 'low',
                'focus': 'reflective',
                'productivity': 40,
                'social': False,
                'tasks': [
                    Task(
                        title='Journal Your Feelings',
                        description='Write freely about what you\'re experiencing right now',
                        category=TaskCategory.THERAPEUTIC,
                        priority='critical',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.95,
                        emoji='📝',
                        why_now='Writing helps process emotions and find clarity',
                        steps=[
                            'Find quiet space',
                            'Write without judgment',
                            'Express all thoughts and feelings',
                            'Read what you wrote'
                        ]
                    ),
                    Task(
                        title='Take a Restorative Break',
                        description='Step away and do something gentle and nurturing',
                        category=TaskCategory.CALMING,
                        priority='critical',
                        estimated_time=20,
                        energy_required='low',
                        mood_match=0.90,
                        emoji='☕',
                        why_now='Rest and self-care are essential when you\'re feeling down',
                        steps=[
                            'Stop work immediately',
                            'Make a warm beverage',
                            'Go outside if possible',
                            'Just breathe and be kind to yourself'
                        ]
                    ),
                    Task(
                        title='Connect With Someone',
                        description='Reach out to a trusted friend or counselor',
                        category=TaskCategory.SOCIAL,
                        priority='high',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.85,
                        emoji='👥',
                        why_now='Support from others helps when you\'re struggling',
                        steps=[
                            'Text or call someone you trust',
                            'Share what\'s on your mind',
                            'Listen if they respond',
                            'Accept their support'
                        ]
                    ),
                ],
                'wellbeing_tip': 'This feeling is temporary. You are not alone. Be gentle with yourself today.',
                'affirmation': 'It\'s okay to not be okay. You will feel better, and I\'m here for you.'
            },
            'angry': {
                'level': MoodLevel.HIGH,
                'energy': 'high',
                'focus': 'intense',
                'productivity': 60,
                'social': False,
                'tasks': [
                    Task(
                        title='Physical Activity / Exercise',
                        description='Channel that intensity into movement - run, gym, or sports',
                        category=TaskCategory.ENERGIZING,
                        priority='critical',
                        estimated_time=45,
                        energy_required='high',
                        mood_match=0.95,
                        emoji='🏃',
                        why_now='Physical activity transforms anger into positive energy',
                        steps=[
                            'Get moving immediately',
                            'Choose high-intensity activity',
                            'Push yourself hard',
                            'Cool down gradually'
                        ]
                    ),
                    Task(
                        title='Write Out Your Frustration',
                        description='Let it all out on paper - no filter, no judgment',
                        category=TaskCategory.THERAPEUTIC,
                        priority='high',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.90,
                        emoji='✍️',
                        why_now='Expression is safer and healthier than internalizing anger',
                        steps=[
                            'Grab pen and paper',
                            'Write everything you feel',
                            'Use strong language if needed',
                            'Tear up the paper afterward'
                        ]
                    ),
                    Task(
                        title='Break Something Temporarily Into Tasks',
                        description='Take your anger out on a big problem - break it apart',
                        category=TaskCategory.PRODUCTIVE,
                        priority='medium',
                        estimated_time=60,
                        energy_required='high',
                        mood_match=0.75,
                        emoji='⚡',
                        why_now='Productive problem-solving uses that energy constructively',
                        steps=[
                            'Identify a challenging problem',
                            'Attack it aggressively methodically',
                            'Break it into smaller pieces',
                            'Solve piece by piece'
                        ]
                    ),
                ],
                'wellbeing_tip': 'Your intensity is a superpower. Channel it productively, not destructively.',
                'affirmation': 'Anger shows you care about something. Let\'s transform it into positive change.'
            },
            'fear': {
                'level': MoodLevel.LOW,
                'energy': 'low',
                'focus': 'safety',
                'productivity': 30,
                'social': False,
                'tasks': [
                    Task(
                        title='Break Down Scary Task',
                        description='Divide that intimidating task into tiny, manageable steps',
                        category=TaskCategory.PRODUCTIVE,
                        priority='high',
                        estimated_time=45,
                        energy_required='medium',
                        mood_match=0.95,
                        emoji='🎯',
                        why_now='Small steps build confidence and reduce fear',
                        steps=[
                            'Identify what scares you',
                            'Break into tiniest steps',
                            'Start with simplest step',
                            'Build momentum gradually'
                        ]
                    ),
                    Task(
                        title='Learn More About Your Fear',
                        description='Knowledge is empowering - understand what you fear',
                        category=TaskCategory.LEARNING,
                        priority='high',
                        estimated_time=60,
                        energy_required='low',
                        mood_match=0.85,
                        emoji='📚',
                        why_now='Understanding reduces fear and builds confidence',
                        steps=[
                            'Research your concern',
                            'Find success stories',
                            'Learn practical solutions',
                            'Create an action plan'
                        ]
                    ),
                    Task(
                        title='Ask for Help & Support',
                        description='Reach out to mentors, friends, or professionals',
                        category=TaskCategory.SOCIAL,
                        priority='critical',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.90,
                        emoji='🤝',
                        why_now='You don\'t have to face this alone',
                        steps=[
                            'Identify who can help',
                            'Be honest about your fear',
                            'Ask for specific support',
                            'Accept help gracefully'
                        ]
                    ),
                ],
                'wellbeing_tip': 'Fear is natural. Courage is taking action despite the fear. You can do this.',
                'affirmation': 'You are braver than you believe. I believe in you, and you should too.'
            },
            'surprise': {
                'level': MoodLevel.NEUTRAL,
                'energy': 'medium',
                'focus': 'adaptive',
                'productivity': 70,
                'social': True,
                'tasks': [
                    Task(
                        title='Process & Reflect',
                        description='Take time to understand what just happened and what it means',
                        category=TaskCategory.CALMING,
                        priority='high',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.95,
                        emoji='💭',
                        why_now='Processing helps you integrate unexpected events',
                        steps=[
                            'Sit quietly and breathe',
                            'Think about what happened',
                            'Understand the implications',
                            'Plan your response'
                        ]
                    ),
                    Task(
                        title='Adapt Your Plan',
                        description='Adjust your schedule and approach based on this surprise',
                        category=TaskCategory.PRODUCTIVE,
                        priority='high',
                        estimated_time=45,
                        energy_required='medium',
                        mood_match=0.85,
                        emoji='🔄',
                        why_now='Quick adaptation turns surprise into opportunity',
                        steps=[
                            'Review your schedule',
                            'Identify what to adjust',
                            'Make quick decisions',
                            'Communicate changes clearly'
                        ]
                    ),
                    Task(
                        title='Share & Discuss',
                        description='Talk about the surprise with others to gain perspective',
                        category=TaskCategory.SOCIAL,
                        priority='medium',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.75,
                        emoji='🗣️',
                        why_now='Others might have useful perspectives or similar experiences',
                        steps=[
                            'Find someone to talk to',
                            'Share what happened',
                            'Listen to their thoughts',
                            'Learn from their experience'
                        ]
                    ),
                ],
                'wellbeing_tip': 'Surprises can be opportunities in disguise. Stay flexible and open.',
                'affirmation': 'Adaptability is your strength. Embrace change with curiosity and grace.'
            },
            'neutral': {
                'level': MoodLevel.NEUTRAL,
                'energy': 'medium',
                'focus': 'balanced',
                'productivity': 75,
                'social': True,
                'tasks': [
                    Task(
                        title='Plan Your Day Strategically',
                        description='Perfect time to organize tasks by priority and energy',
                        category=TaskCategory.PRODUCTIVE,
                        priority='high',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.95,
                        emoji='📋',
                        why_now='Clear mind = clear planning',
                        steps=[
                            'List all tasks',
                            'Prioritize by impact',
                            'Schedule by energy needed',
                            'Set realistic goals'
                        ]
                    ),
                    Task(
                        title='Review & Improve Systems',
                        description='Reflect on what\'s working and what needs adjustment',
                        category=TaskCategory.LEARNING,
                        priority='medium',
                        estimated_time=45,
                        energy_required='low',
                        mood_match=0.85,
                        emoji='⚙️',
                        why_now='Continuous improvement keeps you growing',
                        steps=[
                            'Review recent work',
                            'Identify patterns',
                            'Think of improvements',
                            'Implement one change'
                        ]
                    ),
                    Task(
                        title='Balanced Productivity Session',
                        description='Mix focused work with breaks for sustainable progress',
                        category=TaskCategory.PRODUCTIVE,
                        priority='high',
                        estimated_time=90,
                        energy_required='medium',
                        mood_match=0.80,
                        emoji='⚡',
                        why_now='You have the stability for consistent, quality work',
                        steps=[
                            '25 min focused work',
                            '5 min break',
                            'Repeat 3 times',
                            'Take longer 15 min break'
                        ]
                    ),
                ],
                'wellbeing_tip': 'Stability is valuable. Use this balanced state to build good habits.',
                'affirmation': 'You are in a good place. Make the most of your clear mind and steady energy.'
            },
            'disgust': {
                'level': MoodLevel.MEDIUM,
                'energy': 'low',
                'focus': 'protective',
                'productivity': 50,
                'social': False,
                'tasks': [
                    Task(
                        title='Clean & Organize Space',
                        description='Create a fresh, clean environment to feel better',
                        category=TaskCategory.ENERGIZING,
                        priority='high',
                        estimated_time=45,
                        energy_required='medium',
                        mood_match=0.95,
                        emoji='🧹',
                        why_now='Physical cleansing helps emotional cleansing',
                        steps=[
                            'Start with one small area',
                            'Remove clutter',
                            'Deep clean thoroughly',
                            'Organize for peace of mind'
                        ]
                    ),
                    Task(
                        title='Distance from Negativity',
                        description='Step away from whatever\'s bothering you',
                        category=TaskCategory.CALMING,
                        priority='critical',
                        estimated_time=30,
                        energy_required='low',
                        mood_match=0.90,
                        emoji='🚪',
                        why_now='Removing the trigger helps reset your mood',
                        steps=[
                            'Identify the issue',
                            'Step away temporarily',
                            'Change environment if possible',
                            'Focus on something else'
                        ]
                    ),
                    Task(
                        title='Set Better Boundaries',
                        description='Establish what you will and won\'t accept',
                        category=TaskCategory.PRODUCTIVE,
                        priority='medium',
                        estimated_time=30,
                        energy_required='medium',
                        mood_match=0.75,
                        emoji='⛔',
                        why_now='Preventing future disgust is as important as handling current',
                        steps=[
                            'What caused this feeling?',
                            'What boundary was crossed?',
                            'How will you prevent it?',
                            'Communicate boundaries clearly'
                        ]
                    ),
                ],
                'wellbeing_tip': 'Trust your gut. It\'s okay to say no to things that don\'t sit right.',
                'affirmation': 'Your standards matter. Stand firm in what you believe is right and good.'
            }
        }

    def get_recommendations(self, mood: str, confidence: float, 
                           user_context: Optional[Dict] = None) -> TaskRecommendation:
        """
        Get personalized task recommendations based on mood
        
        Args:
            mood: Current emotional state
            confidence: How confident the mood detection is (0-1)
            user_context: Additional context (previous tasks, preferences, etc.)
        
        Returns:
            TaskRecommendation object with suggested tasks and guidance
        """
        mood_profile = self.mood_profiles.get(mood, self.mood_profiles['neutral'])
        
        tasks = mood_profile.get('tasks', [])
        
        # Sort by mood match
        tasks = sorted(tasks, key=lambda t: t.mood_match, reverse=True)
        
        # Determine mood level based on mood and confidence
        base_level = mood_profile.get('level', MoodLevel.NEUTRAL)
        
        # Next actions based on mood
        next_actions = self._get_next_actions(mood)
        
        # Suggested break time
        productivity = mood_profile.get('productivity', 75)
        break_time = 5 if productivity > 80 else (10 if productivity > 60 else 15)
        
        return TaskRecommendation(
            mood=mood,
            mood_level=base_level,
            confidence=confidence,
            tasks=tasks[:3],  # Top 3 recommendations
            wellbeing_tip=mood_profile.get('wellbeing_tip', ''),
            affirmation=mood_profile.get('affirmation', ''),
            next_actions=next_actions,
            suggested_break_time=break_time
        )

    def _get_next_actions(self, mood: str) -> List[str]:
        """Get immediate next steps based on mood"""
        actions = {
            'happy': [
                'Start something you\'ve been postponing',
                'Share your good mood with someone',
                'Tackle a challenging task',
                'Document your progress'
            ],
            'sad': [
                'Be kind to yourself',
                'Take a break if needed',
                'Talk to someone you trust',
                'Tomorrow is a new day'
            ],
            'angry': [
                'Move your body',
                'Express your feelings safely',
                'Take a step back from decisions',
                'Find the root cause'
            ],
            'fear': [
                'Break it into smaller steps',
                'Gather information',
                'Find support',
                'Face one small piece'
            ],
            'surprise': [
                'Take a moment to process',
                'Adapt your plans',
                'Share your experience',
                'Learn from it'
            ],
            'disgust': [
                'Create physical distance',
                'Clean your environment',
                'Set clear boundaries',
                'Protect your peace'
            ],
            'neutral': [
                'Plan your day',
                'Start a productive session',
                'Review your progress',
                'Improve your systems'
            ]
        }
        return actions.get(mood, actions['neutral'])

    def suggest_break_activity(self, mood: str, duration_minutes: int = 5) -> Dict:
        """Suggest a break activity based on mood"""
        suggestions = {
            'happy': {
                5: 'Share good vibes! Chat with a colleague or friend',
                15: 'Go for a quick walk while listening to upbeat music',
                30: 'Celebrate a win - grab a coffee and enjoy the moment'
            },
            'sad': {
                5: 'Deep breathing exercise - in for 4, hold 4, out for 4',
                15: 'Step outside, look at nature, breathe fresh air',
                30: 'Watch a short funny video or call someone'
            },
            'angry': {
                5: 'Shake it out - jump, dance, release tension',
                15: 'Quick walk to cool off and clear your head',
                30: 'Intense exercise: run, push-ups, or dance hard'
            },
            'fear': {
                5: 'Ground yourself - feel your feet, 5 senses check',
                15: 'Slow breathing and gentle stretching',
                30: 'Meditation or calming music'
            },
            'surprise': {
                5: 'Sit quietly and let your mind wander',
                15: 'Journal about what surprised you',
                30: 'Talk it through with someone'
            },
            'disgust': {
                5: 'Wash your hands/face, reset physically',
                15: 'Clean up your workspace',
                30: 'Shower and change clothes if possible'
            },
            'neutral': {
                5: 'Stretch and hydrate',
                15: 'Short walk to stay fresh',
                30: 'Light snack and social chat'
            }
        }
        
        mood_breaks = suggestions.get(mood, suggestions['neutral'])
        return {
            'activity': mood_breaks.get(duration_minutes, 'Take a mindful breath'),
            'duration': duration_minutes,
            'affects_mood': True
        }


# Singleton instance
_matcher_instance = None


def get_mood_task_matcher() -> MoodTaskMatcher:
    """Get or create singleton instance"""
    global _matcher_instance
    if _matcher_instance is None:
        _matcher_instance = MoodTaskMatcher()
    return _matcher_instance
