export default class ProcessorNode extends AudioWorkletNode {
  /**
   * Initialize the Audio processor by sending the fetched WebAssembly module to
   * the processor worklet.
   *
   * @param {ArrayBuffer} wasmBytes Sequence of bytes.
   * @param {number} blockSize Number of audio samples used
   * for each analysis. Must be a power of 2.
   */
  init(wasmBytes, onProcessCallback, blockSize, delayLength, wetAmount, feedback) {
    this.onProcessCallback = onProcessCallback;
    this.blockSize = blockSize;
    this.delayLength = delayLength;
    this.wetAmount = wetAmount;
    this.feedback = feedback;

    // Listen to messages sent from the audio processor.
    this.port.onmessage = (event) => this.onmessage(event.data);

    this.port.postMessage({
      type: "send-wasm-module",
      wasmBytes,
    });
  }

  // Handle an uncaught exception thrown in the Processor.
  onprocessorerror(err) {
    console.log(
      `An error from AudioWorkletProcessor.process() occurred: ${err}`
    );
  };

  onmessage(event) {
    if (event.type === 'wasm-module-loaded') {
      // The Wasm module was successfully sent to the Processor running on the
      // AudioWorklet thread and compiled. This is our cue to process audio.
      this.port.postMessage({
        type: "init-processor",
        sampleRate: this.context.sampleRate,
        blockSize: this.blockSize,
        delayLength: this.delayLength,
        wetAmount: this.wetAmount,
        feedback: this.feedback,
      });
    } else if (event.type === "update-levels") {
      // Receive level values. Invoke our callback which will result in the UI updating.
      this.onProcessCallback([event.inputLevel, event.outputLevel]);
    } else if (event.type === "set-wet-amount") {
      this.port.postMessage({
          value: event.value
      });
    } else if (event.type === "set-feedback-amount") {
      this.port.postMessage({
          value: event.value
      });
    } else if (event.type === "set-delay-length") {
      this.port.postMessage({
          value: event.value
      });
    }
  }
}
