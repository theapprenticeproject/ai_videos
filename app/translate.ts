// const { IndicTransliterate } = require('@ai4bharat/indic-transliterate');

// // Initialize the transliterator
// const transliterator = new IndicTransliterate();

// // Asynchronous call to load the models
// // (async () => {
// //     await transliterator.load();

// //     // Example transliteration: Roman to Hindi
// //     // const input = "namaste";
// //     // const fromScript = "roman";
// //     // const toScript = "hi";  // ISO 639-1 code for Hindi

// //     // const result = await transliterator.transliterate(input, fromScript, toScript);
// //     // console.log(result);  // Output might be: "नमस्ते"
// //     const input = "नमस्ते";
// // const fromScript = "hi";
// // const toScript = "ta";

// // const result = await transliterator.transliterate(input, fromScript, toScript);
// // console.log(result); // Output: "நமஸ்தே"

// // })();

// const input = "नमस्ते";
// const fromScript = "hi";
// const toScript = "ta";
// async function  run(){
// const result = await transliterator.transliterate(input, fromScript, toScript);
// console.log(result); // Output: "நமஸ்தே"

// }

// run();
import Sanscript from '@indic-transliteration/sanscript';


const word = 'ऑब्जेक्टिव';
let roman = Sanscript.t(word, 'devanagari', 'wx');
// roman = Sanscript.t(word, 'devanagari', 'itrans');
console.log(roman);  // should output romanized fully
