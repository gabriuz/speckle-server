export const speckleApplyAoFrag = `
		uniform sampler2D tDiffuse;
        uniform sampler2D tEdges;
		varying vec2 vUv;
        // #if ACCUMULATE == 1
        //     uniform float frameIndex;
        // #endif
        // const vec3 blank = vec3(1., 1., 1.);

		void main() {
            // vec3 dynamicSample = blank;
            // #if ACCUMULATE == 1
            //     vec3 staticSample = texture2D( tDiffuse, vUv ).rgb;
			//     gl_FragColor.rgb = mix(dynamicSample, staticSample, frameIndex/float(NUM_FRAMES));
            // #elif PASSTHROUGH == 1
            //     gl_FragColor.rgb = texture2D( tDiffuse, vUv ).rgb;
            // #else
            //     gl_FragColor.rgb = dynamicSample;
            // #endif
            gl_FragColor.rgb = texture2D( tDiffuse, vUv ).rgb;
			gl_FragColor.a = 1.;
		}`
