export const broadleafControls: ({
    key: string;
    name: string;
    min: number;
    max: number;
    step: number;
    get: (s: any) => any;
    set: (s: any, v: any) => void;
    dropdown?: undefined;
} | {
    key: string;
    name: string;
    dropdown: {
        Conical: number;
        Spherical: number;
        Hemispherical: number;
        Cylindrical: number;
        'Tapered cyl.': number;
        Flame: number;
        'Inverse conical': number;
        'Tend flame': number;
    };
    get: (s: any) => any;
    set: (s: any, v: any) => void;
    min?: undefined;
    max?: undefined;
    step?: undefined;
})[];
