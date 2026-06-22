import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarOpen: true,
  modals: {},

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openModal: (name, data = null) =>
    set((state) => ({ modals: { ...state.modals, [name]: data ?? true } })),
  closeModal: (name) =>
    set((state) => {
      const modals = { ...state.modals }
      delete modals[name]
      return { modals }
    }),
  isModalOpen: (name) => (state) => !!state.modals[name],
}))
