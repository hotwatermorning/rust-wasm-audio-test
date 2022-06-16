use pitch_detection::{McLeodDetector, PitchDetector};
use wasm_bindgen::prelude::*;
mod utils;

extern crate web_sys;

// A macro to provide `println!(..)`-style syntax for `console.log` logging.
macro_rules! log {
  ( $( $t:tt )* ) => {
    web_sys::console::log_1(&format!( $( $t )* ).into());
  }
}

#[derive(Debug)]
struct DelayLine
{
  length: usize,
  pos: usize,
  array: Vec<f32>,
  wetAmount: f32,
  feedBack: f32,
}

impl DelayLine
{
  pub fn new(length: usize, wetAmount: f32, feedBack: f32) -> DelayLine
  {
    DelayLine {
      length: length,
      pos: 0,
      array: vec![0.0; length],
      wetAmount: wetAmount,
      feedBack: feedBack
    }
  }

  pub fn process(&mut self, sample: f32) -> f32
  {
    let before = sample;

    let dryAmount = 1.0 - self.wetAmount;
    let p = &mut self.array[self.pos];

    let wetSample = sample + *p * self.feedBack;
    *p = wetSample;
    self.pos = (self.pos + 1) % self.length;

    (sample * dryAmount) + (wetSample * self.wetAmount)
//     log!("pos: {}, before: {}, after: {}", self.pos, before, x);
  }

  pub fn dump(&self) -> String {
    format!("{:?}", self)
  }
}

#[wasm_bindgen]
pub struct WasmPitchDetector {
  sample_rate: usize,
  fft_size: usize,
  detector: McLeodDetector<f32>,
  phase: f32,
  delay: DelayLine,
  enable_delay: bool,
}

#[wasm_bindgen]
impl WasmPitchDetector {
  pub fn new(sample_rate: usize, fft_size: usize) -> WasmPitchDetector {
    utils::set_panic_hook();

    let fft_pad = fft_size / 2;

    let d = WasmPitchDetector {
      sample_rate,
      fft_size,
      detector: McLeodDetector::<f32>::new(fft_size, fft_pad),
      phase: 0.0,
      delay: DelayLine::new(8192, 0.5, 0.78),
      enable_delay: true,
    };

//     log!("{}", d.delay.dump());
    d
  }

  pub fn enable_delay(&mut self, to_enable: bool)
  {
    self.enable_delay = to_enable;
  }

  pub fn detect_pitch(&mut self, buffer: &mut [f32]) -> f32 {
    let omega = 440.0 * 2.0 * std::f32::consts::PI / self.sample_rate as f32;

    let before = buffer[0];

    if self.enable_delay {
      for x in buffer.iter_mut() {
        *x = self.delay.process(*x);
        self.phase += omega;
        if self.phase >= 2.0 * std::f32::consts::PI {
          self.phase -= 2.0 * std::f32::consts::PI;
        }
      }
    } else {
      // do nothing
    }

    let after = buffer[0];

//     log!("before {}, after {}", before, after);

    return 0.0

//     if audio_samples.len() < self.fft_size {
//       panic!("Insufficient samples passed to detect_pitch(). Expected an array containing {} elements but got {}", self.fft_size, audio_samples.len());
//     }
// 
//     // Include only notes that exceed a power threshold which relates to the
//     // amplitude of frequencies in the signal. Use the suggested default
//     // value of 5.0 from the library.
//     const POWER_THRESHOLD: f32 = 5.0;
// 
//     // The clarity measure describes how coherent the sound of a note is. For
//     // example, the background sound in a crowded room would typically be would
//     // have low clarity and a ringing tuning fork would have high clarity.
//     // This threshold is used to accept detect notes that are clear enough
//     // (valid values are in the range 0-1).
//     const CLARITY_THRESHOLD: f32 = 0.6;
// 
//     let optional_pitch = self.detector.get_pitch(
//       &audio_samples,
//       self.sample_rate,
//       POWER_THRESHOLD,
//       CLARITY_THRESHOLD,
//     );
// 
//     match optional_pitch {
//       Some(pitch) => pitch.frequency,
//       None => 0.0,
//     }
  }
}
