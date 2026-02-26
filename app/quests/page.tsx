'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target, Coins, Lock, Clock, ChevronRight } from 'lucide-react';

const TEASER_QUESTS = [
  { icon: '♟️', title: '???', description: 'Something awaits the bold...', locked: true },
  { icon: '⚔️', title: '???', description: 'Prove yourself on the board...', locked: true },
  { icon: '🏆', title: '???', description: 'Only the worthy shall claim this...', locked: true },
  { icon: '🔥', title: '???', description: 'A streak of dominance...', locked: true },
  { icon: '👑', title: '???', description: 'Reserved for legends...', locked: true },
];

export default function QuestsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(153,69,255,0.08) 0%, transparent 60%)',
      paddingTop: 100,
      paddingBottom: 80,
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px' }}>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 100,
              background: 'linear-gradient(135deg, rgba(153,69,255,0.12), rgba(0,255,163,0.08))',
              border: '1px solid rgba(153,69,255,0.25)',
              marginBottom: 28,
            }}
          >
            <Clock style={{ width: 14, height: 14, color: '#9945ff' }} />
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#9945ff',
              fontFamily: "'Space Mono', monospace",
            }}>
              Coming Soon
            </span>
          </motion.div>

          {/* Title */}
          <h1 style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 16,
            fontFamily: "'Outfit', sans-serif",
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #e8e8f0 0%, #9945ff 50%, #00ffa3 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Quests
            </span>
          </h1>

          <p style={{
            fontSize: 16,
            color: '#6b6b80',
            lineHeight: 1.7,
            maxWidth: 440,
            margin: '0 auto',
            fontFamily: "'Outfit', sans-serif",
          }}>
            A new chapter is loading. Complete challenges, unlock rewards, and earn your share of something big.
          </p>
        </motion.div>

        {/* Reward Teaser */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{
            padding: '28px 32px',
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(0,255,163,0.04), rgba(153,69,255,0.06))',
            border: '1px solid rgba(153,69,255,0.15)',
            textAlign: 'center',
            marginBottom: 36,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Glow effect */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative' }}>
            <Coins style={{ width: 28, height: 28, color: '#00ffa3', margin: '0 auto 12px' }} />
            <p style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#6b6b80',
              marginBottom: 8,
              fontFamily: "'Space Mono', monospace",
            }}>
              Reward Pool
            </p>
            <p style={{
              fontSize: 36,
              fontWeight: 900,
              fontFamily: "'Space Mono', monospace",
              background: 'linear-gradient(135deg, #00ffa3, #9945ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              200,000,000
            </p>
            <p style={{
              fontSize: 14,
              color: '#9945ff',
              fontWeight: 700,
              fontFamily: "'Space Mono', monospace",
              marginTop: 4,
            }}>
              $MATE
            </p>
            <p style={{
              fontSize: 13,
              color: '#4a4a5e',
              marginTop: 12,
              fontFamily: "'Outfit', sans-serif",
              lineHeight: 1.6,
            }}>
              Play. Compete. Earn. The reward pool is being loaded for those who show up.
            </p>
          </div>
        </motion.div>

        {/* Quest List Teaser */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}
        >
          {TEASER_QUESTS.map((quest, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.08 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'default',
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(153,69,255,0.08)',
                border: '1px solid rgba(153,69,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}>
                {quest.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#4a4a5e',
                  fontFamily: "'Outfit', sans-serif",
                  marginBottom: 2,
                }}>
                  {quest.title}
                </p>
                <p style={{
                  fontSize: 12,
                  color: '#3a3a4e',
                  fontFamily: "'Outfit', sans-serif",
                }}>
                  {quest.description}
                </p>
              </div>
              <Lock style={{ width: 16, height: 16, color: '#3a3a4e', flexShrink: 0 }} />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          style={{
            textAlign: 'center',
            padding: '24px 28px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Sparkles style={{ width: 20, height: 20, color: '#9945ff', margin: '0 auto 10px' }} />
          <p style={{
            fontSize: 14,
            color: '#6b6b80',
            fontFamily: "'Outfit', sans-serif",
            lineHeight: 1.7,
          }}>
            Stay sharp. Play matches. Build your record.
            <br />
            <span style={{ color: '#9945ff', fontWeight: 600 }}>
              When quests go live, your history matters.
            </span>
          </p>
        </motion.div>

      </div>
    </div>
  );
}
