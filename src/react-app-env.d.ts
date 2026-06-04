/// <reference types="react-scripts" />

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const css: string;
  export default css;
}

declare module '*.scss' {
  const scss: string;
  export default scss;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.jpg' {
  const url: string;
  export default url;
}

declare module '*.jpeg' {
  const url: string;
  export default url;
}

declare module '*.gif' {
  const url: string;
  export default url;
}

declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.ico' {
  const url: string;
  export default url;
}

declare module '*.webp' {
  const url: string;
  export default url;
}
