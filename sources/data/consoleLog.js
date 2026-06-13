import * as THREE from 'three/webgpu'

const text = `
+ Mojtaba Alehosseini / Spatial Portfolio ++

Intro
Thank you for visiting my portfolio, curious developer.
This fork adapts Bruno Simon's 2025 spatial portfolio for my AI, ML, computer vision, and analytics work.

Profile
Name      => Mojtaba Alehosseini
Location  => Genova, Italy
Focus     => LLMs, computer vision, dashboards, and model-to-product systems
Education => M.Sc. Computer Science, AI track, University of Genova
Open to   => AI/ML internships and graduate roles in the EU from 2026/2027

Links
Site     => https://mojtaba-alehosseini.github.io/
GitHub   => https://github.com/Mojtaba-Alehosseini
LinkedIn => https://www.linkedin.com/in/mojtaba-alehosseini/
Mail     => alehoseini.mojtaba@gmail.com

Stack
Python, PyTorch, scikit-learn, Pandas, NumPy, SQL, Power BI, Linux, Flask, Git

Three.js
Three.js renders this 3D world (release: ${THREE.REVISION})
https://threejs.org/

Source code
Original project => https://github.com/brunosimon/folio-2025
Personal site    => https://github.com/Mojtaba-Alehosseini

Audio
The music included with the original portfolio was made by Kounine and released under CC0.
https://linktr.ee/Kounine
`

let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[+=|>-]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [finalText, ...finalStyles]
