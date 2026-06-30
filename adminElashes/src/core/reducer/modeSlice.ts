import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AppMode = "salon" | "marketplace";

interface ModeState {
  current: AppMode;
  switching: boolean;
}

function inferModeFromUrl(): AppMode {
  return window.location.pathname.startsWith("/marketplace") ? "marketplace" : "salon";
}

const initialState: ModeState = {
  current: inferModeFromUrl(),
  switching: false,
};

const modeSlice = createSlice({
  name: "mode",
  initialState,
  reducers: {
    beginSwitch(state) {
      state.switching = true;
    },
    commitMode(state, action: PayloadAction<AppMode>) {
      state.current = action.payload;
      state.switching = false;
      localStorage.setItem("appMode", action.payload);
    },
  },
});

export const { beginSwitch, commitMode } = modeSlice.actions;
export default modeSlice.reducer;
