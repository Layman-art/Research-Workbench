import { workbenchRepository } from '../repositories';
import { createWorkbenchStore } from './workbenchStore';

export const useStore = createWorkbenchStore(workbenchRepository);
export { uid } from './workbenchStore';
export type { WorkbenchState } from './workbenchStore';
export { countForType, selectFiltered } from '../store/selectors';
