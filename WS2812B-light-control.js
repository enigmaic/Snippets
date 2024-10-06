// Below are some snippets of the index.js file of my room ambient light control logic

async function renderLEDs(colors, preset, anim) { // function used for rendering the LED strip
  let [red, green, blue] = (preset ? [0, 0, 0] : colors ? colors : [0, 0, 0]) // if the function was called with a preset, it uses the given preset

  if (channel.brightness == 0) { // if the channel brightness is 0, it means that the leds were used previously
    for (var i = 0; i < NUM_LEDS; i++) { // iterates through the channel colorArray, and sets each diode to 0 (off)
      colorArray[i] = 0
    }
    channel.brightness = 255; // after each diode has been set to 0, th brightness is reset back to max (255)
  }

  animations = { // render animations object
    "StartEnd": async function() { // starts two loops starting from the two ends of the strip, with each loop moving in towards the center
      const firstLoop = (async () => {
          for (let i = 0; i <= 118; i++) {
              colorArray[i] = preset ? preset[i] : (red << 16) | (green << 8) | blue;
              await wait(20);
              ws281x.render();
          }
      })();

      const secondLoop = (async () => {
          for (let i = 255; i >= 119; i--) {
              colorArray[i] = preset ? preset[i] : (red << 16) | (green << 8) | blue;
              await wait(10);
              ws281x.render();
          }
      })();


      await Promise.all([firstLoop, secondLoop]) // runs both loops together/concurrently
    },

    "Start": async function() { // starts rendering from the start of the strip (right, towards left in this case)
      for (let i = 0; i <= NUM_LEDS; i++) {
        colorArray[i] = preset ? preset[i] : (red << 16) | (green << 8) | blue;
        await wait(5);
        ws281x.render();
      }
    },

    "End": async function() { // starts rendering from the end to the start, (left towards right)
      for (let i =  NUM_LEDS; i >= 0; i--) {
        colorArray[i] = preset ? preset[i] : (red << 16) | (green << 8) | blue;
        await wait(5)
        ws281x.render();
      }
    },

    "Middle": async function() { // starts rendering from the middle, towards the start and end (right, left)
      const firstLoop = (async () => {
          for (let i = 119; i <= NUM_LEDS; i++) {
              colorArray[i] = preset ? preset[i] : (red << 16) | (green << 8) | blue;
              await wait(20);
              ws281x.render();
          }
      })();

      const secondLoop = (async () => {
          for (let i = 118; i >= 0; i--) {
              colorArray[i] = preset ? preset[i] : (red << 16) | (green << 8) | blue;
              await wait(10);
              ws281x.render();
          }
      })();


      await Promise.all([firstLoop, secondLoop])
    },

    "Fade": async function() { // gradually lowers the channel brightness
      for (var i = NUM_LEDS; i >= 0; i -= 5) {
        channel.brightness = i
        await wait(20);
        ws281x.render()
      }
    }

  }


  if (preset && preset.every(x => x == 0)) { // if the given preset contains all zeroes, it assumes the leds are supposed to turn off - calling the Fade animation
    animations["Fade"]();
  } else { // if the preset isn't all zeroes, it applies the preset with the given animation
    if (colors || preset) {
      animations[anim]();
    }
  }

}
