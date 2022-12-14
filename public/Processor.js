import "./TextEncoder.js";
import init, { WasmProcessor } from "./wasm-audio/wasm_audio.js";

class Processor extends AudioWorkletProcessor {
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
    this.levels = [];

    // Listen to events from the ProcessorNode running on the main thread.
    this.port.onmessage = (event) => this.onmessage(event.data);

    this.processor = null;
  }

  onmessage(event) {
    if (event.type === "send-wasm-module") {
      // ProcessorNode has sent us a message containing the Wasm library to load into
      // our context as well as information about the audio device used for
      // recording.
      init(WebAssembly.compile(event.wasmBytes)).then(() => {
        this.port.postMessage({ type: 'wasm-module-loaded' });
      });
    } else if (event.type === 'init-processor') {
      const { sampleRate, blockSize, delayLength, wetAmount, feedback } = event;

      // Store this because we use it later to process when we have enough recorded
      // audio samples for our first analysis.
      this.blockSize = blockSize;

      this.processor = WasmProcessor.new(
        sampleRate,
        blockSize,
        delayLength,
        wetAmount,
        feedback
      );

      // Holds a buffer of audio sample values that we'll send to the Wasm module
      // for analysis at regular intervals.
      this.processBuffer = new Float32Array(blockSize).fill(0);
      this.outputBuffer = new Float32Array(blockSize + blockSize).fill(0);
      this.numProcessBufferSamples = 0;
      this.numOutputBufferSamples = this.outputBuffer.length;
      this.levels = new Float32Array(2).fill(0);
    } else if(event.type === "set-wet-amount") {
      this.processor.set_wet_amount(event.value);
    } else if(event.type === "set-feedback-amount") {
      this.processor.set_feedback_amount(event.value);
    } else if(event.type === "set-delay-length") {
      this.processor.set_delay_length(event.value);
    }
  }

  process(inputs, outputs) {

    // inputs contains incoming audio samples for further processing. outputs
    // contains the audio samples resulting from any processing performed by us.

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

    // Once our buffer has enough samples, pass them to the Wasm processor.
    if (this.numProcessBufferSamples >= this.blockSize && this.processor) {
      const saved = new Array(this.blockSize);
      for(let i = 0; i < this.blockSize; ++i) {
        saved[i] = this.processBuffer[i];
      }

      this.levels.fill(0);

      this.processor.process(this.processBuffer, this.levels);

      // this.port.postMessage({
      //   type: "update-levels",
      //   inputLevel: this.levels[0],
      //   outputLevel: this.levels[1],
      // });

      {
        // push output buffer
        const currentSize = this.numOutputBufferSamples;
        for (let i = 0; i < this.blockSize; ++i) {
          this.outputBuffer[currentSize + i] = this.processBuffer[i];
        }
        this.numOutputBufferSamples = currentSize + this.blockSize;
      }

      {
        const numToMove = this.numProcessBufferSamples - this.blockSize;
        for(let i = 0; i < numToMove; ++i) {
          this.processBuffer[i] = this.processBuffer[i + this.blockSize];
        }
        this.numProcessBufferSamples = numToMove;
      }
    }

    // Returning true tells the Audio system to keep going.
    return true;
  }
}

registerProcessor("Processor", Processor);
