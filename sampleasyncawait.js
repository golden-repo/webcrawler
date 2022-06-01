//jshint esversion: 6
//jshint ignore:start
// async function f() {

//     let promise = new Promise((resolve, reject) => {
//       setTimeout(() => {
//         console.log('method called');
//         resolve("done!")
//       }, 1000);
//     });
//     console.log('calling promise');
//     let result = await promise; // wait till the promise resolves (*)
  
//     console.log(result); // "done!"
//   }
  
//   f();

let data = {};
let data1 = '<option selected="selected" value="Select City or Airport">Select City or Airport</option>\
<option value="4">Bagdogra // Bangalore</option>\
<option value="3">Bagdogra // Chennai</option>\
<option value="1">Bagdogra // Delhi</option>\
<option value="2">Bagdogra // Kolkata</option>\
<option value="60">Bangalore // Delhi</option>\
<option value="51">Bangalore // Mumbai</option>\
<option value="85">Chennai // Mumbai</option>\
<option value="5">Delhi // Bagdogra</option>\
<option value="57">Delhi // Guwahati</option>\
<option value="38">Delhi // Kolkata</option>\
<option value="58">Guwahati // Delhi</option>\
<option value="68">Guwahati // Kolkata</option>\
<option value="67">Kolkata // Ahmedabad</option>\
<option value="6">Kolkata // Bagdogra</option>\
<option value="55">Kolkata // Bangalore</option>\
<option value="26">Kolkata // Chennai</option>\
<option value="37">Kolkata // Delhi</option>\
<option value="56">Kolkata // Guwahati</option>\
<option value="47">Kolkata // Hyderabad</option>\
<option value="48">Kolkata // Jaipur</option>\
<option value="32">Kolkata // Mumbai</option>\
<option value="9">Kolkata // Portblair</option>\
<option value="33">Mumbai // Kolkata</option>\
<option value="10">Portblair // Kolkata</option>';

data['name'] = 'Himadri Majumdar';
data['age'] = 46;
data['dob'] = '1973-10-20';
data.getName = function() {
  return this['name'];
}

function dataMirror() {
  return this['age'];
}

let strreg = /\>(.*?)\</gm;
let grps = data1.match(strreg).map((val, idx) => val.replace('>','').replace('<','')).filter((val, idx) => {
  if(idx%2===0)
    return val.replace('>','').replace('<','');
  else
    return false;
});

console.log(grps);
//console.log(typeof(Object.entries(data)[3][1]) === 'function');

// console.log(Object.getOwnPropertyNames(data));
// let firstKeyName = Object.getOwnPropertyNames(data)[3];
// console.log(data[firstKeyName]());
// data[firstKeyName] = dataMirror;

// console.log(dataMirror());
// console.log(data[firstKeyName]());
  //jshint ignore:end