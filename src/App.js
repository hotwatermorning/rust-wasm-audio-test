import React from "react";
import "./App.css";
import { setupAudio } from "./setupAudio";

function PitchReadout({ running, latestPitch }) {
  return (
    <div className="Pitch-readout">
      {latestPitch
        ? `Latest pitch: ${latestPitch.toFixed(1)} Hz`
        : running
        ? "Listening..."
        : "Paused"}
    </div>
  );
}

function AudioRecorderControl() {
  // Ensure the latest state of the audio module is reflected in the UI
  // by defining some variables (and a setter function for updating them)
  // that are managed by React, passing their initial values to useState.

  // 1. audio is the object returned from the initial audio setup that
  //    will be used to start/stop the audio based on user input. While
  //    this is initialized once in our simple application, it is good
  //    practice to let React know about any state that _could_ change
  //    again.
  const [audio, setAudio] = React.useState(undefined);

  // 2. running holds whether the application is currently recording and
  //    processing audio and is used to provide button text (Start vs Stop).
  const [running, setRunning] = React.useState(false);

  // 3. latestPitch holds the latest detected pitch to be displayed in
  //    the UI.
  const [latestPitch, setLatestPitch] = React.useState(undefined);

  // Initial state. Initialize the web audio once a user gesture on the page
  // has been registered.
  if (!audio) {
    return (
      <button
        onClick={async () => {
          setAudio(await setupAudio(setLatestPitch));
          setRunning(true);
        }}
      >
        Start listening
      </button>
    );
  }

  // Audio already initialized. Suspend / resume based on its current state.
  const { context } = audio;
  return (
    <div>
      <button
        onClick={async () => {
          if (running) {
            await context.suspend();
            setRunning(context.state === "running");
          } else {
            await context.resume();
            setRunning(context.state === "running");
          }
        }}
        disabled={context.state !== "running" && context.state !== "suspended"}
      >
        {running ? "Pause" : "Resume"}
      </button>
      <PitchReadout running={running} latestPitch={latestPitch} />
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        Wasm Audio Tutorial
      </header>
      <div className="App-content">
        <AudioRecorderControl />
      </div>
    </div>
  );
}

export default App;
