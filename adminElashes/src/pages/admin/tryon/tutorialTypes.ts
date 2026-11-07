import type { RenderProfile, OptionGroups } from '@/core/services/tryon/tryon.service';
import type { StyleHelpTopic } from './styleHelpTopics';
import type { PreviewSelection } from './previewGeometry';
export type VisualTutorialTopic = Omit<StyleHelpTopic, 'key'> & {
    key: string;
    captions?: [
        string,
        string
    ];
    formatValue?: (value: number) => string;
};
export interface TutorialDemo {
    profile: RenderProfile;
    selection: PreviewSelection;
    options: OptionGroups;
    note: string;
}
