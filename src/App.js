import React, { useEffect, useState } from "react";
import "./App.css";
import { setupAudio } from "./setupAudio";

function SliderWithName({name, parameterId, onChangeParameter, defaultValue}) {
  return (
    <div className="slider-with-name">
      <div className="slider-name">{name}</div>
      <input className="slider-body" type="range" defaultValue={defaultValue} min={0} max={1} step={"any"}
  onChange={(event) => onChangeParameter(parameterId, event.target.value)}>
      </input>
    </div>
  );
}

function Control({ onChangeParameter }) {
  return (
    <>
      <SliderWithName
        name={"Wet Amount"}
        parameterId={"wet-amount"}
        onChangeParameter={onChangeParameter}
        defaultValue={0.5}
      />
      <SliderWithName
        name={"Feedback"}
        parameterId={"feedback-amount"}
        onChangeParameter={onChangeParameter}
        defaultValue={0.5}
      />
      <SliderWithName
        name={"Delay Length"}
        parameterId={"delay-length"}
        onChangeParameter={onChangeParameter}
        defaultValue={0.2}
      />
    </>
  );
}

function LevelMeter({ decibel, minDecibel, maxDecibel }) {
  decibel = Math.min(maxDecibel, Math.max(decibel, minDecibel));
  let range = maxDecibel - minDecibel;
  let ratio = (decibel - minDecibel) / range;

  let width = 40;
  let height = 200;
  let x = (1.0 - ratio) * height;
  return (
    <svg width={width} height={height} viewBox={`0, 0, ${width}, ${height}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={0} y={0} width={width} height={height} fill="#241212"></rect>
      <rect x={x} y={0} width={width} height={height - x} fill="#7CFC00"></rect>
    </svg>
  );
}

// function DeviceSelector({onSelected})
// {
//   const [ devices, setDevices ] = useState(undefined);
//
//   useEffect(() => {
//     (async () => {
//       setDevices(await navigator.mediaDevices.enumerateDevices());
//     })();
//   }, []);
//
//   return (
//     <>
//     </>
//   );
// }

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

  // 3. level values
  const [levels, setLevels] = React.useState(undefined);

  // Initial state. Initialize the web audio once a user gesture on the page
  // has been registered.
  if (!audio) {
    return (
      <button
        onClick={async () => {
          setAudio(await setupAudio(setLevels));
          setRunning(true);
        }}
      >
        Start listening
      </button>
    );
  }

  const changeParameter = (type, value) => {
    if(type === "wet-amount") {
      audio.node.port.postMessage({
        type: "set-wet-amount",
        value
      });
    } else if(type === "feedback-amount") {
      audio.node.port.postMessage({
        type: "set-feedback-amount",
        value
      });
    } else if(type === "delay-length") {
      audio.node.port.postMessage({
        type: "set-delay-length",
        value
      });
    }
  };

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
      <Control running={running} onChangeParameter={changeParameter} />
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
