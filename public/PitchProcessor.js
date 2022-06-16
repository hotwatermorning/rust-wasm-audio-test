import "./TextEncoder.js";
import init, { WasmPitchDetector } from "./wasm-audio/wasm_audio.js";

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Initialized to an array holding a buffer of samples for analysis later -
    // once we know how many samples need to be stored. Meanwhile, an empty
    // array is used, so that early calls to process() with empty channels
    // do not break initialization.
    this.processBuffer = [];
    this.numProcessBufferSamples = 0;
    this.outputBuffer = [];
    this.numOutputBufferSamples = 0;

    // Listen to events from the PitchNode running on the main thread.
    this.port.onmessage = (event) => this.onmessage(event.data);

    this.detector = null;
  }

  onmessage(event) {
    if (event.type === "send-wasm-module") {
      // PitchNode has sent us a message containing the Wasm library to load into
      // our context as well as information about the audio device used for
      // recording.
      init(WebAssembly.compile(event.wasmBytes)).then(() => {
        this.port.postMessage({ type: 'wasm-module-loaded' });
      });
    } else if (event.type === 'init-detector') {
      const { sampleRate, numAudioSamplesPerAnalysis } = event;

      // Store this because we use it later to detect when we have enough recorded
      // audio samples for our first analysis.
      this.numAudioSamplesPerAnalysis = numAudioSamplesPerAnalysis;

      this.detector = WasmPitchDetector.new(sampleRate, numAudioSamplesPerAnalysis);

      // Holds a buffer of audio sample values that we'll send to the Wasm module
      // for analysis at regular intervals.
      this.processBuffer = new Float32Array(numAudioSamplesPerAnalysis).fill(0);
      this.outputBuffer = new Float32Array(numAudioSamplesPerAnalysis + 128).fill(0);
      this.numProcessBufferSamples = 0;
      this.numOutputBufferSamples = this.outputBuffer.length;
    }
  };

  process(inputs, outputs) {

    // inputs contains incoming audio samples for further processing. outputs
    // contains the audio samples resulting from any processing performed by us.
    // Here, we are performing analysis only to detect pitches so do not modify
    // outputs.

    // inputs holds one or more "channels" of samples. For example, a microphone
    // that records "in stereo" would provide two channels. For this simple app,
    // we use assume either "mono" input or the "left" channel if microphone is
    // stereo.

    const inputChannels = inputs[0];
    const outputChannels = outputs[0];

    // inputSamples holds an array of new samples to process.
    const inputSamples = inputChannels[0];
    const outputSamples = outputChannels[0];
    const len = inputSamples.length;

    for (let i = 0; i < len; ++i) {
      outputSamples[i] = this.outputBuffer[i];
    }

    const numToMove = this.numOutputBufferSamples - len;
    for (let i = 0; i < numToMove; ++i) {
      this.outputBuffer[i] = this.outputBuffer[i + len];
    }
    this.numOutputBufferSamples = numToMove;

    for(let i = 0; i < len; ++i) {
      this.processBuffer[this.numProcessBufferSamples + i] = inputSamples[i];
    }
    this.numProcessBufferSamples += len;

    // Once our buffer has enough samples, pass them to the Wasm pitch detector.
    if (this.numProcessBufferSamples >= this.numAudioSamplesPerAnalysis && this.detector) {
      const saved = new Array(this.numAudioSamplesPerAnalysis);
      for(let i = 0; i < this.numAudioSamplesPerAnalysis; ++i) {
        saved[i] = this.processBuffer[i];
      }

      const result = this.detector.detect_pitch(this.processBuffer, this.numAudioSamplesPerAnalysis);

      if (result !== 0) {
        this.port.postMessage({ type: "pitch", pitch: result });
      }

      {
        // push output buffer
        const currentSize = this.numOutputBufferSamples;
        for (let i = 0; i < this.numAudioSamplesPerAnalysis; ++i) {
          this.outputBuffer[currentSize + i] = this.processBuffer[i];
        }
        this.numOutputBufferSamples = currentSize + this.numAudioSamplesPerAnalysis;
      }

      {
        const numToMove = this.numProcessBufferSamples - this.numAudioSamplesPerAnalysis;
        for(let i = 0; i < numToMove; ++i) {
          this.processBuffer[i] = this.processBuffer[i + this.numAudioSamplesPerAnalysis];
        }
        this.numProcessBufferSamples = numToMove;
      }
    }

    // Returning true tells the Audio system to keep going.
    return true;
  }
}

registerProcessor("PitchProcessor", PitchProcessor);
