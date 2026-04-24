import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Sparkles,
  Brain,
  CalendarDays,
  NotebookPen,
  Target,
  Timer,
  Layers3,
  Workflow,
  ShieldCheck,
  Rocket,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const featureCards = [
  {
    title: 'Unified Productivity Hub',
    description: 'Calendar, notes, goals, habits, focus, and canvas workspaces in one fluid system.',
    icon: Layers3,
  },
  {
    title: 'Smart AI Companion',
    description: 'Context-aware chat that understands your projects and helps plan, summarize, and unblock.',
    icon: Brain,
  },
  {
    title: 'Automated Reminders',
    description: 'Novu-powered in-app and email notifications for deadlines, focus, journal, and review cycles.',
    icon: Workflow,
  },
  {
    title: 'Goal-Centered Execution',
    description: 'Tie notes, milestones, events, and sessions directly to goals so momentum compounds daily.',
    icon: Target,
  },
];

const processSteps = [
  {
    title: 'Capture',
    description: 'Collect ideas in notes, thoughts, and canvas boards before they slip.',
    icon: NotebookPen,
  },
  {
    title: 'Plan',
    description: 'Map goals and schedule focused time with reminders and clear milestones.',
    icon: CalendarDays,
  },
  {
    title: 'Execute',
    description: 'Run time-boxed focus sessions, track habits, and keep progress visible in one dashboard.',
    icon: Timer,
  },
  {
    title: 'Review & Improve',
    description: 'Weekly insights and AI guidance help you iterate on what works fastest.',
    icon: Rocket,
  },
];

const integrations = [
  'Novu Notifications',
  'Supabase Postgres',
  'JWT Auth',
  'Render Deploys',
  'Ollama AI',
  'React Query',
];

const pricing = [
  {
    name: 'Free',
    price: '$0',
    subtitle: 'Everything included, with starter limits',
    highlight: false,
    bullets: [
      'All core features enabled',
      'Up to 3 sub-workspaces per module',
      'Up to 25 AI chats per month',
      'In-app notification inbox',
      'Perfect for getting started',
    ],
  },
  {
    name: 'Pro',
    price: '$5',
    subtitle: 'More room to build serious workflows',
    highlight: true,
    bullets: [
      'All Free features',
      'Up to 15 sub-workspaces per module',
      'Up to 300 AI chats per month',
      'Priority reminder scheduling',
      'Best value for power users',
    ],
  },
  {
    name: 'Supporter',
    price: '$10',
    subtitle: 'Maximum scale and premium AI experience',
    highlight: false,
    bullets: [
      'Unlimited sub-workspaces',
      'Greatly increased chat allowance',
      'Advanced AI assistant modes',
      'Early access to new capabilities',
      'Supports long-term product growth',
    ],
  },
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function useParallaxScroll(disabled) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (disabled) {
      setScrollY(0);
      return undefined;
    }
    let rafId = null;
    const update = () => {
      rafId = null;
      setScrollY(window.scrollY || 0);
    };
    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [disabled]);

  return scrollY;
}

function useRevealSection({
  reducedMotion,
  delayMs = 0,
  distancePx = 18,
  rootMargin = '0px 0px -10% 0px',
}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, rootMargin]);

  const style = reducedMotion
    ? undefined
    : {
        opacity: isVisible ? 1 : 0,
        transform: `translate3d(0, ${isVisible ? 0 : distancePx}px, 0)`,
        transition: `opacity 540ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
      };

  return { ref, style, isVisible };
}

export default function LandingPage() {
  const { user } = useAuth();
  const prefersReducedMotion = usePrefersReducedMotion();
  const scrollY = useParallaxScroll(prefersReducedMotion);

  const heroReveal = useRevealSection({ reducedMotion: prefersReducedMotion, delayMs: 20, distancePx: 12 });
  const featuresReveal = useRevealSection({ reducedMotion: prefersReducedMotion, delayMs: 40 });
  const processReveal = useRevealSection({ reducedMotion: prefersReducedMotion, delayMs: 60 });
  const integrationsReveal = useRevealSection({ reducedMotion: prefersReducedMotion, delayMs: 80 });
  const pricingReveal = useRevealSection({ reducedMotion: prefersReducedMotion, delayMs: 100 });
  const ctaReveal = useRevealSection({ reducedMotion: prefersReducedMotion, delayMs: 120 });

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const orbAStyle = prefersReducedMotion
    ? undefined
    : { transform: `translate3d(${Math.min(24, scrollY * 0.03)}px, ${Math.min(46, scrollY * 0.06)}px, 0)` };
  const orbBStyle = prefersReducedMotion
    ? undefined
    : { transform: `translate3d(${Math.max(-30, scrollY * -0.04)}px, ${Math.min(35, scrollY * 0.045)}px, 0)` };
  const orbCStyle = prefersReducedMotion
    ? undefined
    : { transform: `translate3d(${Math.min(18, scrollY * 0.022)}px, ${Math.max(-24, scrollY * -0.03)}px, 0)` };
  const heroPanelStyle = prefersReducedMotion
    ? undefined
    : {
        transform: `translate3d(0, ${Math.min(24, scrollY * 0.04)}px, 0)`,
        transition: 'transform 120ms linear',
      };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-violet-600/35 blur-3xl will-change-transform"
          style={orbAStyle}
        />
        <div
          className="absolute top-24 right-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl will-change-transform"
          style={orbBStyle}
        />
        <div
          className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl will-change-transform"
          style={orbCStyle}
        />
      </div>

      <div className="relative">
        <header className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center font-bold">
                Q
              </div>
              <div>
                <p className="font-semibold tracking-tight">Quorex</p>
                <p className="text-xs text-slate-300">Integrated productivity intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:border-white/35 hover:bg-white/10 transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 hover:opacity-90 transition-opacity font-medium"
              >
                Sign up
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 pb-20">
          {/* Hero */}
          <section ref={heroReveal.ref} style={heroReveal.style} className="pt-12 md:pt-16">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200 mb-5">
                  <Sparkles size={13} />
                  Built for high-output creators, founders, and teams
                </div>
                <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
                  Your work system.
                  <span className="block bg-gradient-to-r from-violet-300 via-cyan-200 to-fuchsia-300 bg-clip-text text-transparent">
                    Finally in one place.
                  </span>
                </h1>
                <p className="mt-5 text-slate-300 text-lg max-w-xl">
                  Quorex blends planning, execution, and AI guidance into a single operating layer so you can
                  move faster without losing clarity.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-gradient"
                  >
                    Start free
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 hover:border-white/35 hover:bg-white/10 transition-colors"
                  >
                    I already have an account
                  </Link>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  Trusted workflow stack for builders shipping in fast cycles.
                </p>
              </div>

              <div
                className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-2xl p-5 shadow-2xl shadow-violet-900/20 will-change-transform"
                style={heroPanelStyle}
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  {featureCards.map(({ title, description, icon: Icon }, idx) => (
                    <div
                      key={title}
                      className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
                      style={prefersReducedMotion ? undefined : {
                        opacity: heroReveal.isVisible ? 1 : 0,
                        transform: `translate3d(0, ${heroReveal.isVisible ? 0 : 12}px, 0)`,
                        transition: `opacity 420ms ease ${220 + idx * 80}ms, transform 560ms cubic-bezier(0.22, 1, 0.36, 1) ${220 + idx * 80}ms`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-200 flex items-center justify-center mb-3">
                        <Icon size={16} />
                      </div>
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs text-slate-300 mt-1">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section ref={featuresReveal.ref} style={featuresReveal.style} className="mt-20">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Everything connected by design</h2>
            <p className="text-slate-300 mt-2 max-w-2xl">
              Every module shares context so your goals, notes, habits, calendar, and AI sessions reinforce each other.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {[
                'Goals + milestones',
                'Rich notes + linked context',
                'Habit streak tracking',
                'Focus session analytics',
                'Thought boards + comments',
                'Visual canvas planning',
                'Recurring reminders',
                'Activity feed timeline',
              ].map((item, idx) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                  style={prefersReducedMotion ? undefined : {
                    opacity: featuresReveal.isVisible ? 1 : 0,
                    transform: `translate3d(0, ${featuresReveal.isVisible ? 0 : 12}px, 0)`,
                    transition: `opacity 420ms ease ${120 + idx * 45}ms, transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + idx * 45}ms`,
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Check size={14} className="text-emerald-300" />
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Process */}
          <section ref={processReveal.ref} style={processReveal.style} className="mt-20">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">A process you can actually sustain</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {processSteps.map(({ title, description, icon: Icon }, idx) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/2 p-5"
                  style={prefersReducedMotion ? undefined : {
                    opacity: processReveal.isVisible ? 1 : 0,
                    transform: `translate3d(0, ${processReveal.isVisible ? 0 : 16}px, 0)`,
                    transition: `opacity 460ms ease ${140 + idx * 70}ms, transform 680ms cubic-bezier(0.22, 1, 0.36, 1) ${140 + idx * 70}ms`,
                  }}
                >
                  <p className="text-xs text-violet-200 font-medium mb-3">Step {idx + 1}</p>
                  <div className="w-9 h-9 rounded-lg bg-violet-500/20 text-violet-200 flex items-center justify-center mb-3">
                    <Icon size={18} />
                  </div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-slate-300 mt-1">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Integrations */}
          <section ref={integrationsReveal.ref} style={integrationsReveal.style} className="mt-20">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="flex items-center gap-2 text-cyan-200">
                <ShieldCheck size={18} />
                <p className="font-medium">Integrations and platform stack</p>
              </div>
              <p className="text-slate-300 mt-2">
                Quorex is designed to plug into modern services while keeping a clean, secure architecture.
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-6">
                {integrations.map((integration, idx) => (
                  <div
                    key={integration}
                    className="rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-100"
                    style={prefersReducedMotion ? undefined : {
                      opacity: integrationsReveal.isVisible ? 1 : 0,
                      transform: `translate3d(0, ${integrationsReveal.isVisible ? 0 : 10}px, 0)`,
                      transition: `opacity 420ms ease ${120 + idx * 55}ms, transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + idx * 55}ms`,
                    }}
                  >
                    {integration}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section ref={pricingReveal.ref} style={pricingReveal.style} className="mt-20">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Simple pricing for growing workflows</h2>
            <p className="text-slate-300 mt-2">
              Start free, upgrade when your workspace count and AI usage scale.
            </p>
            <div className="grid lg:grid-cols-3 gap-5 mt-8">
              {pricing.map((plan, idx) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-6 ${
                    plan.highlight
                      ? 'border-violet-400/60 bg-violet-500/10 shadow-xl shadow-violet-800/25'
                      : 'border-white/10 bg-white/5'
                  }`}
                  style={prefersReducedMotion ? undefined : {
                    opacity: pricingReveal.isVisible ? 1 : 0,
                    transform: `translate3d(0, ${pricingReveal.isVisible ? 0 : 14}px, 0)`,
                    transition: `opacity 480ms ease ${140 + idx * 90}ms, transform 720ms cubic-bezier(0.22, 1, 0.36, 1) ${140 + idx * 90}ms`,
                  }}
                >
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="text-4xl font-bold mt-2">{plan.price}</p>
                  <p className="text-xs text-slate-300 mt-1">per month</p>
                  <p className="text-sm text-slate-300 mt-4">{plan.subtitle}</p>
                  <ul className="mt-5 space-y-2">
                    {plan.bullets.map((bullet) => (
                      <li key={bullet} className="text-sm text-slate-100 flex items-start gap-2">
                        <Check size={14} className="text-emerald-300 mt-0.5 shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/register"
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:opacity-90'
                        : 'border border-white/20 hover:bg-white/10'
                    }`}
                  >
                    Choose {plan.name}
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Pricing and limits shown are launch targets and may evolve as the platform matures.
            </p>
          </section>

          {/* Closing CTA */}
          <section ref={ctaReveal.ref} style={ctaReveal.style} className="mt-20">
            <div className="rounded-2xl border border-violet-400/35 bg-gradient-to-r from-violet-600/20 via-indigo-600/15 to-cyan-600/15 p-8 text-center">
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Build your system once. Scale it daily.</h3>
              <p className="text-slate-200 mt-2">
                Join Quorex and turn scattered productivity into compounding momentum.
              </p>
              <div className="mt-6 flex justify-center gap-3 flex-wrap">
                <Link to="/register" className="px-5 py-2.5 rounded-lg btn-gradient">
                  Start for free
                </Link>
                <Link to="/login" className="px-5 py-2.5 rounded-lg border border-white/25 hover:bg-white/10 transition-colors">
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
