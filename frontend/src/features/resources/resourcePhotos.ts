export type ResourcePhotoCredit = {
  src: string;
  alt: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
};

export const resourcePhotos: Record<string, ResourcePhotoCredit | undefined> = {
  'Arduino starter kit': {
    src: '/resources/arduino-kit.jpg',
    alt: 'An Arduino experimentation kit with a board, breadboard, wires and components.',
    author: 'oomlout',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:ARDX_-_Arduino_Experimentation_Kit_(Inside_the_box).jpg',
  },
  'Raspberry Pi 4 + power supply': {
    src: '/resources/raspberry-pi-4.jpg',
    alt: 'Top view of a Raspberry Pi 4 Model B circuit board.',
    author: 'Laserlicht',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Raspberry_Pi_4_Model_B_-_Top.jpg',
  },
  'Precision screwdriver set': {
    src: '/resources/precision-screwdrivers.jpg',
    alt: 'An electronic precision screwdriver kit with interchangeable bits.',
    author: 'Project Kei',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Electronic_Precision_Screwdriver_Set.jpg',
  },
  'Spare breadboards & jumper wires': {
    src: '/resources/jumper-wires.jpg',
    alt: 'Colorful jumper wires for breadboard prototyping.',
    author: 'oomlout',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    source: 'https://commons.wikimedia.org/wiki/File:A_few_Jumper_Wires.jpg',
  },
  'USB-C hub with HDMI': {
    src: '/resources/usb-c-hub-v2.jpg',
    alt: 'A silver USB-C hub with USB ports, card readers and an HDMI port.',
    author: 'Khalid Bencherifa',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    source: 'https://commons.wikimedia.org/wiki/File:USB-C_Hubb_5_portar.jpg',
  },
  'Prototype materials bundle': {
    src: '/resources/foamboard.jpg',
    alt: 'Foam board sheets used for models and prototypes.',
    author: 'Sweetie candykim',
    license: 'CC0',
    licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    source: 'https://commons.wikimedia.org/wiki/File:Foamboard.JPG',
  },
};
