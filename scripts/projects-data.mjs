/**
 * Source of truth for the artwork shown in the projects area.
 *
 * Titles, blurbs and stacks here are taken from the GitHub repositories
 * themselves, so the cards, the 3D labels and the repo pages agree.
 * `sources/data/projects.js` drives the 3D scene; this file drives the images
 * that scene displays. Keep the `key` values in step between the two.
 */

// Sampled straight out of static/palette.png so the cards sit in the same
// colour world as the rest of the game.
export const PALETTE = {
    ink: '#14131a',
    inkSoft: '#1d1b25',
    paper: '#fff2e8',
    muted: '#7c7691',
    cyan: '#3dbbe7',
    amber: '#e4a90c',
    sage: '#91ad78',
    olive: '#abae2b',
    orange: '#e56202',
    ember: '#ec3f1c',
    purple: '#c366ef',
    pink: '#ed719f',
    peach: '#f8a658'
}

export const PROJECTS = [
    {
        key: 'hand-frame',
        title: 'Hand Frame Effects',
        blurb: 'Frame a region of the webcam feed with both hands and live art effects render inside it.',
        accent: PALETTE.cyan,
        stack: [ 'JavaScript', 'MediaPipe' ],
        faces: [
            { kind: 'cover' },
            { kind: 'graphic', graphic: 'handFrame' },
            { kind: 'notes', notes: [ 'Runs entirely in the browser', 'Two-hand region framing', 'No install, no server' ] }
        ]
    },
    {
        key: 'pneumonia-xray',
        title: 'Pneumonia X-ray Classifier',
        blurb: 'Pneumonia detection from chest X-rays by transfer learning across VGG, ResNet and NASNet.',
        accent: PALETTE.pink,
        stack: [ 'TensorFlow', 'Keras' ],
        faces: [
            { kind: 'cover' },
            { kind: 'photo', photo: 'pneumonia-roc.png', caption: 'ROC curve — final model' },
            // Read off the confusion matrix in the repo (92/8 and 11/89)
            { kind: 'notes', notes: [ '92% recall on pneumonia', '89% recall on normal', 'VGG, ResNet and NASNet compared' ] }
        ]
    },
    {
        key: 'gpu-energy',
        title: 'GPU Cost & Energy',
        blurb: 'Dollars-per-watt for machine learning: a cost and energy dashboard with a replay mode.',
        accent: PALETTE.amber,
        stack: [ 'Prometheus', 'Grafana' ],
        faces: [
            { kind: 'cover' },
            { kind: 'graphic', graphic: 'gauge' },
            { kind: 'notes', notes: [ '5.24 samples per watt', '€0.027 per training run', 'Replay mode needs no GPU' ] }
        ]
    },
    {
        key: 'mlops-pipeline',
        title: 'MLOps Pipeline',
        blurb: 'A reproducible training pipeline wired to CI, with a promotion gate in front of the registry.',
        accent: PALETTE.sage,
        stack: [ 'DVC', 'MLflow' ],
        faces: [
            { kind: 'cover' },
            { kind: 'graphic', graphic: 'pipeline' },
            { kind: 'notes', notes: [ 'DVC-tracked data and models', 'LightGBM training runs', 'GitHub Actions promotion gate' ] }
        ]
    },
    {
        key: 'change-detection',
        title: 'Change Detection',
        blurb: 'A motion-analysis pipeline that segments moving blobs and matches them between frames.',
        accent: PALETTE.purple,
        stack: [ 'OpenCV', 'Python' ],
        faces: [
            { kind: 'cover' },
            { kind: 'graphic', graphic: 'blobs' },
            { kind: 'notes', notes: [ 'Background subtraction', 'Otsu thresholding', 'Frame-to-frame blob matching' ] }
        ]
    },
    {
        key: 'marketplace',
        title: 'Marketplace Optimisation',
        blurb: 'A surplus-food marketplace simulator comparing stocking rules and allocation policies.',
        accent: PALETTE.ember,
        stack: [ 'Python', 'SciPy' ],
        faces: [
            { kind: 'cover' },
            { kind: 'photo', photo: 'marketplace-policies.png', caption: 'Policy comparison' },
            { kind: 'notes', notes: [ 'Newsvendor stocking rules', 'Greedy vs assignment-LP', 'Sell-through, waste, coverage' ] }
        ]
    },
    {
        key: 'genetic-algorithm',
        title: 'Genetic Algorithm',
        blurb: 'Evolutionary search over a fitness landscape using selection, crossover and mutation.',
        accent: PALETTE.olive,
        stack: [ 'MATLAB' ],
        faces: [
            { kind: 'cover' },
            { kind: 'graphic', graphic: 'evolution' },
            { kind: 'notes', notes: [ 'Tournament selection', 'Crossover and mutation', 'Convergence over generations' ] }
        ]
    },
    {
        key: 'dump-truck',
        title: 'Dump Truck Problem',
        blurb: 'Discrete-event simulation of a loader, scale and haul route modelled as a queue network.',
        accent: PALETTE.peach,
        stack: [ 'FreeBASIC' ],
        faces: [
            { kind: 'cover' },
            { kind: 'graphic', graphic: 'queue' },
            { kind: 'notes', notes: [ 'Loader and scale servers', 'Haul and return delays', 'Throughput vs fleet size' ] }
        ]
    }
]
