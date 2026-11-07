import { useCallback } from 'react';
import type { RenderProfile, OptionGroups } from '@/core/services/tryon/tryon.service';
import VisualTutorialDialog from './VisualTutorialDialog';
import { helpProfile, helpValue, styleHelpTopic, styleHelpTopics } from './styleHelpTopics';
import type { StyleHelpKey } from './styleHelpTopics';
const options: OptionGroups = { length: [], technique: [], thickness: [] };
const techniques = ['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'];
export default function StyleHelpDialog({ topicKey, profile, onClose, onTopicChange }: {
    topicKey: StyleHelpKey;
    profile: RenderProfile;
    onClose: () => void;
    onTopicChange: (key: StyleHelpKey) => void;
}) {
    const topic = styleHelpTopic(topicKey), index = styleHelpTopics.findIndex(t => t.key === topicKey);
    const renderDemo = useCallback((value: number) => ({ profile: helpProfile(profile, topicKey, value), selection: { length: 1, technique: topic.technique, thickness: 3 }, options, note: `Ejemplo con tu perfil · ${techniques[topic.technique]} · largo medio · 0.15 mm.` }), [profile, topicKey, topic.technique]);
    return <VisualTutorialDialog topic={topic} currentValue={helpValue(profile, topicKey)} renderDemo={renderDemo} onClose={onClose} stepLabel={`${index + 1} de ${styleHelpTopics.length}`} onPrevious={() => onTopicChange(styleHelpTopics[(index + styleHelpTopics.length - 1) % styleHelpTopics.length].key)} onNext={() => onTopicChange(styleHelpTopics[(index + 1) % styleHelpTopics.length].key)}/>;
}
