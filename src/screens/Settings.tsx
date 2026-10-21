/**
 * 設定（タブバーから開く画面）
 */
import { motion, useReducedMotion } from 'motion/react';
import { Backdrop } from '../components/Backdrop';
import { SettingsBody } from '../components/SettingsBody';
import { tickContainer, tickItem, tickItemReduced } from '../motion/tokens';
import { useApp } from '../state/AppContext';
import './Settings.css';

export function Settings() {
  const reduce = useReducedMotion();
  const { navigate } = useApp();
  const item = reduce ? tickItemReduced : tickItem;
  return (
    <div className="screen__inner settings-screen">
      <Backdrop kind="settings" />
      <motion.div className="settings-screen__body" variants={tickContainer(0.06, 0.1)} initial="hidden" animate="show">
        <motion.header className="settings-screen__head" variants={item}>
          <p className="kicker">ATELIER SETTINGS</p>
          <h1 className="heading">設定</h1>
        </motion.header>
        <motion.div className="settings-screen__card" variants={item}>
          <SettingsBody onClose={() => navigate('hall')} />
        </motion.div>
      </motion.div>
    </div>
  );
}
