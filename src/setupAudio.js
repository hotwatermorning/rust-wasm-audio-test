import ProcessorNode from "./ProcessorNode";

/*
audioinput : 既定 - MacBook Pro Microphone (Built-in) : default
setupAudio.js:14 audioinput : BlackHole 64ch (Virtual) : 047f096c25552c490de4f582ffcf7cd97fc7456d49321c5437bbae486406ad37
setupAudio.js:14 audioinput : MacBook Pro Microphone (Built-in) : 70608a39fb682b7a1c3e01a80f83ccc182ad2f051c9f553d4dc3d6b67e222781
setupAudio.js:14 audioinput : VB-Cable (Virtual) : e51d45e84eaeda29649183715daa5933a7e992662e606c988797d0652568771c
setupAudio.js:14 audioinput : ZoomAudioDevice (Virtual) : 45e3fd7fd7a9d62240addee2844650abc1719a335d37fe4a5769062d26ba8ddf
setupAudio.js:14 videoinput :  :
setupAudio.js:14 audiooutput : 既定 - External Headphones (Built-in) : default
setupAudio.js:14 audiooutput : BlackHole 64ch (Virtual) : 047f096c25552c490de4f582ffcf7cd97fc7456d49321c5437bbae486406ad37
setupAudio.js:14 audiooutput : External Headphones (Built-in) : 8cbd1aaec12613a0cfeb98a54535827bf846becf522eda5de4aa8df16cbb22ad
setupAudio.js:14 audiooutput : MacBook Pro Speakers (Built-in) : 490713ab9dd95f95fcac40c6c45f2306b77a06d55ba3d5281452d777b90d1bec
setupAudio.js:14 audiooutput : VB-Cable (Virtual) : e51d45e84eaeda29649183715daa5933a7e992662e606c988797d0652568771c
setupAudio.js:14 audiooutput : ZoomAudioDevice (Virtual) : 45e3fd7fd7a9d62240addee2844650abc1719a335d37fe4a5769062d26ba8ddf
*/

async function getWebAudioMediaStream() {
  if (!window.navigator.mediaDevices) {
    throw new Error(
      "This browser does not support web audio or it is not enabled."
    );
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    for(const device of devices) {
        console.log(`${device.kind} : ${device.label} : ${device.deviceId}`);
    }

    for(const device of devices) {
        if(device.kind === "audioinput" && device.label.indexOf("MacBook Pro Microphone") !== -1) {
            return await window.navigator.mediaDevices.getUserMedia({
                audio: { deviceId: device.deviceId },
                video: false
            });
        }
    }

  } catch(e) {
      console.log(e.name + ": " + e.message);
  }

  try {
    const result = await window.navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    return result;
  } catch (e) {
    switch (e.name) {
      case "NotAllowedError":
        throw new Error(
          "A recording device was found but has been disallowed for this application. Enable the device in the browser settings."
        );

      case "NotFoundError":
        throw new Error(
          "No recording device was found. Please attach a microphone and click Retry."
        );

      default:
        throw e;
    }
  }
}

export async function setupAudio(onProcessCallback) {
  // Get the browser audio. Awaits user "allowing" it for the current tab.
  const mediaStream = await getWebAudioMediaStream();

  const context = new window.AudioContext({
    latencyHint: "balanced",
    sampleRate: 44100
  });
  const audioSource = context.createMediaStreamSource(mediaStream);

  let node;

  try {
    // Fetch the WebAssembly module that performs processing audio.
    const response = await window.fetch("wasm-audio/wasm_audio_bg.wasm");
    const wasmBytes = await response.arrayBuffer();

    // Add our audio processor worklet to the context.
    const processorUrl = "Processor.js";
    try {
      await context.audioWorklet.addModule(processorUrl);
    } catch (e) {
      throw new Error(
        `Failed to load audio analyzer worklet at url: ${processorUrl}. Further info: ${e.message}`
      );
    }

    // Create the AudioWorkletNode which enables the main JavaScript thread to
    // communicate with the audio processor (which runs in a Worklet).
    node = new ProcessorNode(context, "Processor");

    // blockSize specifies the number of consecutive audio samples of
    // each processing unit of work. Larger values tend
    // to produce slightly more accurate results but are more expensive to compute and
    // can lead to notes being missed in faster passages i.e. where the music note is
    // changing rapidly. 1024 is usually a good balance between efficiency and accuracy
    // for music analysis.
    const blockSize = 128;

    // Send the Wasm module to the audio node which in turn passes it to the
    // processor running in the Worklet thread. Also, pass any configuration
    // parameters for the Wasm audio processing.
    node.init(wasmBytes, onProcessCallback, blockSize, 0.2, 0.5, 0.5);

    // Connect the audio source (microphone output) to our analysis node.
    audioSource.connect(node);

    // Connect our analysis node to the output. Required even though we do not
    // output any audio. Allows further downstream audio processing or output to
    // occur.
    node.connect(context.destination);
  } catch (err) {
    throw new Error(
      `Failed to load audio analyzer WASM module. Further info: ${err.message}`
    );
  }

  return { context, node };
}
