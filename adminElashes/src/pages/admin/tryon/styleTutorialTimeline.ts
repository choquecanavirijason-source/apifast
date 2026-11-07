import type { VisualTutorialTopic } from './tutorialTypes';
export const tutorialDuration = 24;
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export const tutorialViews = [{ name: 'Frente', yaw: 0, pitch: .04 }, { name: 'Perfil', yaw: 1.15, pitch: .12 }, { name: 'Desde arriba', yaw: 0, pitch: 1.25 }];
export function tutorialFrame(topic: VisualTutorialTopic, seconds: number) {
    const finished = seconds >= tutorialDuration, t = finished ? 22 : Math.max(0, Math.min(tutorialDuration - .001, seconds));
    const chapter = Math.floor(t / 8), local = t % 8, turn = chapter === 2 ? 0 : smooth(local - 7);
    const order = topic.view === 'profile' ? [1, 0, 2] : [0, 1, 2], a = tutorialViews[order[chapter]], b = tutorialViews[order[(chapter + 1) % 3]];
    const mix = local < 2 ? 0 : local < 5 ? smooth((local - 2) / 3) : local < 7 ? 1 : 1 - turn;
    const raw = topic.low + (topic.high - topic.low) * mix;
    const value = Number((Math.round(raw / topic.step) * topic.step).toFixed(3));
    return { value, chapter, view: a.name, phase: finished ? 'finished' : local < 2 ? 'low' : local < 5 ? 'changing' : local < 7 || chapter === 2 ? 'high' : 'turning', camera: { yaw: a.yaw + (b.yaw - a.yaw) * turn, pitch: a.pitch + (b.pitch - a.pitch) * turn, zoom: 1.05 } };
}
export function tutorialCaptions(topic: VisualTutorialTopic) {
    if (topic.captions)
        return topic.captions;
    if (topic.key === 'curl')
        return ['Más recta', 'Más curvada'];
    if (topic.key === 'fan')
        return ['Fibras más juntas', 'Fibras más abiertas'];
    if (topic.key === 'sweep')
        return ['Menos inclinación exterior', 'Más inclinación hacia la sien'];
    if (topic.key === 'spike_every')
        return ['Un pico cada 2 grupos', 'Un pico cada 8 grupos'];
    if (topic.key === 'spike_multiplier')
        return ['Picos más cortos', 'Picos más largos'];
    if (topic.key === 'width_multiplier')
        return ['Fibras más finas', 'Fibras más anchas'];
    if (topic.key.endsWith('fan_spread'))
        return ['Grupos más cerrados', 'Grupos más abiertos'];
    return ['Menos grupos', 'Más grupos'];
}
