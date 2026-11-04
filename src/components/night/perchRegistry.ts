import { Animated } from 'react-native';
import type { SceneName } from '../../../theme';

// Where things are on screen, in window coordinates, for each scene. Screens record where their city sits and the
// skyline spots the mascot can hang from; BatTransition flies from the bat's current spot to a skyline spot on the
// next screen.
export type Frame = { x: number; y: number; width: number; height: number; hero: boolean };
export type Spot = { x: number; y: number };

const cities: Partial<Record<SceneName, Frame>> = {};
// Per scene, per source (currently just 'city'): the spots it offers. The city's first spot is the skyline perch
// the bat lands on after a transition.
const spots: Partial<Record<SceneName, Record<string, Spot[]>>> = {};
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export function recordCity(scene: SceneName, frame: Frame) {
  cities[scene] = frame;
  notify();
}

export function recordSpots(scene: SceneName, source: string, list: Spot[]) {
  (spots[scene] ??= {})[source] = list;
  notify();
}

export function cityFor(scene: SceneName): Frame | undefined {
  return cities[scene];
}

/** Spots in this scene's skyline (landmark, antenna, rooftop edges), the landing perch first. */
export function skylineSpots(scene: SceneName): Spot[] {
  return spots[scene]?.city ?? [];
}

/** The skyline spot the bat lands on when it arrives at this scene. */
export function skylineSpot(scene: SceneName): Spot | undefined {
  return spots[scene]?.city?.[0];
}

// Where the roaming bat is hanging right now, so a transition can take off from exactly there.
let batAt: Spot | null = null;
export function setBatSpot(spot: Spot | null) {
  batAt = spot;
}
export function batSpot() {
  return batAt;
}

// While a transition is flying the bat, the roaming bat stays out of the way.
let traveling = false;
export function setTraveling(value: boolean) {
  traveling = value;
  notify();
}
export function isTraveling() {
  return traveling;
}

// When the most recently focused screen finished mounting. BatTransition waits for this (showing the landscape loader
// if it takes a while) before landing the bat.
let readyAt = 0;
export function markScreenReady() {
  readyAt = Date.now();
  notify();
}
export function screenReadySince(time: number) {
  return readyAt >= time;
}

export function onPerchesChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Drives every screen's content entrance. BatTransition drops it to 0 when a trip starts (the content is hidden under
 * the overlay anyway) and springs it back to 1 as the overlay clears, so buttons and text arrive with the bat.
 */
export const arrival = new Animated.Value(1);

/**
 * Drives the current screen's goodbye before a navigation: its city eases down and fades (0 → 1). Reset to 0 as the
 * next screen arrives. See `depart` in BatTransition.
 */
export const departing = new Animated.Value(0);

/**
 * 0 = each screen shows its own small city; 1 = the big skyline behind the content instead. Tab trips swap to the big
 * skyline for the flight and back again afterwards, beneath the page so its buttons can come and go on top of it.
 */
export const tallness = new Animated.Value(0);

/** How tall the big skyline is, as a share of the window height. */
export const TALL_SHARE = 0.55;
