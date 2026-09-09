'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { LampFloor, Power, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import './login.css';

export default function LoginPage() {
  const [lampOn, setLampOn] = useState(false);
  const cordY = useMotionValue(0);
  const cordHeight = useTransform(cordY, value => 60 + value);
  const [pullReady, setPullReady] = useState(false);
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.4;
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const toggleLamp = () => { setLampOn(value => !value); setVisible(false); setMessage(''); };
  return <main className={`login-page lamp-login ${lampOn ? 'lamp-is-on' : 'lamp-is-off'}`}>
    <header className="login-header">
      <Link className="login-brand" href="/" aria-label="SORTCRM home"><span><Sparkles size={20}/></span><div>SORTCRM<small>A little order. A lot of possibility.</small></div></Link>
      <Link href="/" className="login-preview-link">Explore the workspace<ArrowUpRight size={14}/></Link>
    </header>
    <section className="login-experience" aria-labelledby="login-title">
      <div className="login-lamp-side"><div className="lamp-scene">
        <div className={`lamp-toggle lamp-drag-control ${pullReady ? 'pull-ready' : ''}`}>
        <motion.div className="lamp-light" aria-hidden="true" initial={false} animate={{ opacity: lampOn ? 1 : 0 }} transition={{ duration }}/>
          <motion.span className="lamp-fixture" ><LampFloor size={340} strokeWidth={0.8}/></motion.span>
          <div className="lamp-cord-track">
            <motion.span className="lamp-cord-line" style={{ height: cordHeight }} aria-hidden="true"/>
            <motion.button type="button" className="lamp-cord-handle" style={{ y: cordY }} drag="y" dragConstraints={{ top: 0, bottom: 80 }} dragElastic={0} dragMomentum={false} dragSnapToOrigin
              aria-label={lampOn ? 'Pull cord to turn lamp off' : 'Pull cord to turn lamp on'} aria-pressed={lampOn} aria-controls="lamp-login-fields" aria-describedby="lamp-pull-hint"
              onDrag={(_event, info) => setPullReady(info.offset.y >= 40)}
              onDragEnd={(event, info) => { if (event.type !== 'pointercancel' && info.offset.y >= 40) toggleLamp(); setPullReady(false); }}
              onClick={event => { if (event.detail === 0) toggleLamp(); }}>
              <Power size={16}/>
            </motion.button>
          </div>
          <span className="lamp-switch-label" id="lamp-pull-hint">{pullReady ? 'RELEASE TO SWITCH' : lampOn ? 'PULL DOWN TO TURN OFF' : 'PULL DOWN TO TURN ON'}</span>
        </div>
      </div>
      <div className="login-welcome"><span className="login-eyebrow">{lampOn ? 'GOOD TO HAVE YOU HERE' : 'A LITTLE LIGHT. A FRESH START.'}</span><h1 id="login-title">{lampOn ? 'You’re almost in' : 'Your workspace awaits'}<span>.</span></h1><p>{lampOn ? 'The light is on. Come in and make great things happen.' : 'Pull the cord down to light up your workspace and reveal sign-in.'}</p></div>
      </div>
      <div className="lamp-form-stage">
        <div id="lamp-login-fields" inert={!lampOn}>
        <AnimatePresence initial={false}>
        {lampOn && <motion.div key="login-form" className="login-card" initial={{ opacity: 0, x: reduceMotion ? 0 : 110 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : 110 }} transition={{ duration }}>

        <div className="login-card-heading"><span className="login-key"><LockKeyhole size={17}/></span><div><h2>Welcome to your workspace</h2><p>Pick up where the good work left off.</p></div></div>
        <form onSubmit={event => { event.preventDefault(); setMessage('Account sign-in isn’t available yet. Explore the demo workspace below—no account needed.'); }}>
          <label htmlFor="login-email">Work email</label><div className="login-field"><Mail size={16}/><Input id="login-email" type="email" name="email" placeholder="you@company.com" autoComplete="username" required/></div>
          <label htmlFor="login-password">Password</label><div className="login-field"><LockKeyhole size={15}/><Input id="login-password" type={visible ? 'text' : 'password'} name="password" placeholder="Enter your password" autoComplete="current-password" required/><button type="button" className="login-reveal" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
          {message && <output className="login-message" aria-live="polite">{message}</output>}
          <Button type="submit" className="login-submit">Sign in to workspace<ArrowRight size={16}/></Button>
        </form>
        <div className="login-divider"><span/>OR TAKE A LOOK AROUND<span/></div>
        <Link href="/" className="login-demo">Explore demo workspace<ArrowUpRight size={15}/></Link>
        <p className="login-availability"><span/>Demo is open. Account sign-in is coming soon.</p>
      </motion.div>}
        </AnimatePresence>
        </div>
        {!lampOn && <div className="lamp-sleeping"><LockKeyhole size={21}/><p>Your sign-in is just a little light away.</p><span>Drag the cord downward · or focus it and press Enter</span></div>}
      </div>

    </section>
    <footer className="login-footer"><span>© {new Date().getFullYear()} SORTCRM</span><span>Made for teams with big plans<span className="login-footer-star">✦</span></span></footer>
  </main>;
}
