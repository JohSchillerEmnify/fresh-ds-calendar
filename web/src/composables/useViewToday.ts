/** Today button of a date-less view with one (`LabsView.today`, labs-timeline): the view reports now on screen and how to return. */
import { ref, shallowRef } from 'vue';

/** Whether now is on screen in the open date-less view (the Today button is filled then). */
export const nowShown = ref(false);
/** Brings the open date-less view back to now; null while no such view is open. */
export const goToNow = shallowRef<(() => void) | null>(null);
