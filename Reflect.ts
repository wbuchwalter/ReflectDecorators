"use strict";

module Reflect {
    const weakMetadata = new WeakMap<any, Map<any, any>>();
    const weakPropertyMetadata = new WeakMap<any, Map<PropertyKey, Map<any, any>>>();
    const weakParameterMetadata = new WeakMap<Function, Map<number, Map<any, any>>>();

    function isFunction(x: any): boolean {
        return typeof x === "function";
    }

    function isObject(x: any): boolean {
        return (x != null && typeof x === "object") || isFunction(x);
    }

    function isNumber(x: any): boolean {
        return typeof x === "number";
    }

    function isPropertyKey(x: any): boolean {
        return typeof x === "string" || typeof x === "symbol";
    }
        
    /**
      * Applies a set of decorators to a target object.
      * @param target The target object.
      * @param decorators An array of decorators.
      * @remarks Decorators are applied in reverse order.
      */
    export function decorate(target: Function, ...decorators: ((target: Function) => Function | void)[]): Function {
        for (let i = decorators.length - 1; i >= 0; i--) {
            let decorator = decorators[i];
            let decorated = decorator(target);
            if (decorated === null || decorated === undefined) {
                continue;
            }
            target = <Function>decorated;
        }
        return target;
    }
    
    /**
      * Applies a set of decorators to a property of a target object.
      * @param target The target object.
      * @param propertyKey The property key to decorate.
      * @param decorators An array of decorators.
      * @remarks Decorators are applied in reverse order.
      */
    export function decorateProperty(target: any, propertyKey: PropertyKey, ...decorators: ((target: any, propertyKey: PropertyKey, descriptor: PropertyDescriptor) => PropertyDescriptor | void)[]): any {
        let descriptor = Reflect.getOwnPropertyDescriptor(target, propertyKey);
        if (descriptor === undefined) {
            descriptor = { enumerable: true, configurable: true, writable: true };
        }

        let { enumerable, configurable, writable, get, set, value } = descriptor;
        for (let i = decorators.length - 1; i >= 0; i--) {
            let decorator = decorators[i];
            let decorated = decorator(target, propertyKey, descriptor);
            if (decorated === null || decorated === undefined) {
                continue;
            }
            descriptor = <PropertyDescriptor>decorated;
        }

        if (enumerable !== descriptor.enumerable ||
            configurable !== descriptor.configurable ||
            writable !== descriptor.writable ||
            value !== descriptor.value ||
            get !== descriptor.get ||
            set !== descriptor.set) {
            Object.defineProperty(target, propertyKey, descriptor);
        }
        return target;
    }
    
    /**
      * Applies a set of decorators to a function parameter.
      * @param target The target function.
      * @param parameterIndex The index of the parameter to decorate.
      * @param decorators An array of decorators.
      * @remarks Decorators are applied in reverse order.
      */
    export function decorateParameter(target: Function, parameterIndex: number, ...decorators: ((target: Function, paramterIndex: number) => void)[]): void {
        for (let i = decorators.length - 1; i >= 0; i--) {
            let decorator = decorators[i];
            decorator(target, parameterIndex);
        }
    }
    
    /**
      * A default metadata decorator that can be used on a class, class member, or parameter.
      * @example
      *
      *     // on class
      *     @Reflect.metadata(key, value)
      *     class MyClass {
      *
      *         // on member
      *         @Reflect.metadata(key, value)
      *         method1() { 
      *         }
      *
      *         // on parameter
      *         method2(@Reflect.metadata(key, value) x) {
      *         }
      *     }
      */
    export function metadata(metadataKey: any, metadata: any) {
        return function(target: Function | Object, keyOrIndex?: PropertyKey | number): void {
            if (isObject(target) && isPropertyKey(keyOrIndex)) {
                // (target: Object, key: string | symbol)
                definePropertyMetadata(<Object>target, <string>keyOrIndex, metadataKey, metadata);
            }
            else if (isFunction(target) && isNumber(keyOrIndex)) {
                // (target: Function, index: number)
                defineParameterMetadata(<Function>target, <number>keyOrIndex, metadataKey, metadata);
            }
            else if (isFunction(target)) {
                // (target: Function)
                defineMetadata(<Function>target, metadataKey, metadata);
            }
        }
    }
    
    /**
      * Gets the own metadata for a property on an object, a parameter of a function, or an object.
      */
    export function metadataFor(metadataKey: any, target: Object): any;
    export function metadataFor(metadataKey: any, target: Object, propertyKey: PropertyKey): any;
    export function metadataFor(metadataKey: any, target: Function, paramIndex: number): any;
    export function metadataFor(metadataKey: any, target: Function | Object, keyOrIndex?: PropertyKey | number): any {
        if (isObject(target) && isPropertyKey(keyOrIndex)) {
            return getOwnPropertyMetadata(target, <PropertyKey>keyOrIndex, metadataKey);
        }
        else if (isFunction(target) && isNumber(keyOrIndex)) {
            return getParameterMetadata(<Function>target, <number>keyOrIndex, metadataKey);
        }
        else {
            return getOwnMetadata(target, metadataKey);
        }
    }

    /**
      * Define a unique metadata entry on the target.
      * @param target The target object on which to define metadata.
      * @param metadataKey A key used to store and retrieve metadata.
      * @param metadata A value that contains attached metadata.
      * @example
      * ```
      * // Component decorator factory as metadata-producing annotation.
      * function Component(options) {
      *     return (target) => { Reflect.defineMetadata(target, Component, options); }
      * }
      * ```      
      */
    export function defineMetadata(target: any, metadataKey: any, metadata: any): void {
        let metadataMap = weakMetadata.get(target);
        if (!metadataMap) {
            metadataMap = new Map<any, any>();
            weakMetadata.set(target, metadataMap);
        }
        metadataMap.set(metadataKey, metadata);
    }
    
    /**
      * Gets a value indicating whether the target object or its prototype chain has the provided metadata key defined.
      * @param target The target object on which the metadata is defined.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata key was defined on the target object or its prototype chain; otherwise, `false`.
      */
    export function hasMetadata(target: any, metadataKey: any): boolean {
        while (target) {
            if (Reflect.hasOwnMetadata(target, metadataKey)) {
                return true;
            }
            target = Reflect.getPrototypeOf(target);
        }
        return false;
    }

    /**
      * Gets the metadata value for the provided metadata key on the target object or its prototype chain.
      * @param target The target object on which the metadata is defined.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
      * @example
      * ```
      * let metadata = Reflect.getMetadata(target, Component);
      * ```
      */
    export function getMetadata(target: any, metadataKey: any): any {
        while (target) {
            if (Reflect.hasOwnMetadata(target, metadataKey)) {
                return Reflect.getOwnMetadata(target, metadataKey);
            }
            target = Reflect.getPrototypeOf(target);
        }
        return undefined;
    }

    /**
      * Gets the metadata keys defined on the target object or its prototype chain.
      * @param target The target object on which the metadata is defined.
      * @returns An array of unique metadata keys.
      */
    export function getMetadataKeys(target: any): any[] {
        let keySet = new Set<any>();
        let keys: any[] = [];
        while (target) {
            for (let key of Reflect.getOwnMetadataKeys(target)) {
                if (!keySet.has(key)) {
                    keySet.add(key);
                    keys.push(key);
                }
            }
            target = Reflect.getPrototypeOf(target);
        }
        return keys;
    }

    /**
      * Gets a value indicating whether the target object has the provided metadata key defined.
      * @param target The target object on which the metadata is defined.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata key was defined on the target object; otherwise, `false`.
      */
    export function hasOwnMetadata(target: any, metadataKey: any): boolean {
        let metadataMap = weakMetadata.get(target);
        if (metadataMap) {
            return metadataMap.has(metadataKey);
        }
        return false;
    }

    /**
      * Gets the metadata value for the provided metadata key on the target object.
      * @param target The target object on which the metadata is defined.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
      * @example
      * ```
      * let metadata = Reflect.getOwnMetadata(target, Component);
      * ```
      */
    export function getOwnMetadata(target: any, metadataKey: any): any {
        let metadataMap = weakMetadata.get(target);
        if (metadataMap) {
            return metadataMap.get(metadataKey);
        }
        return undefined;
    }

    /**
      * Gets the unique metadata keys defined on the target object.
      * @param target The target object on which the metadata is defined.
      * @returns An array of unique metadata keys.
      */
    export function getOwnMetadataKeys(target: any): any[] {
        let metadataMap = weakMetadata.get(target);
        if (metadataMap) {
            return [...metadataMap.keys()];
        }
        return [];
    }

    /**
      * Deletes the metadata entry from the target object with the provided key.
      * @param target The target object on which the metadata is defined.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata entry was found and deleted; otherwise, false.
      */
    export function deleteOwnMetadata(target: any, metadataKey: any): boolean {
        let metadataMap = weakMetadata.get(target);
        if (metadataMap) {
            return metadataMap.delete(metadataKey);
        }
        return false;
    }

    /**
      * Define a metadata entry on a property of the target.
      * @param target The target object on which to define metadata.
      * @param propertyKey The key of the property on the target.
      * @param metadataKey A key used to store and retrieve metadata.
      * @param metadata A value that contains attached metadata.
      * @example
      * ```
      * // MarshalAs decorator factory as metadata-producing annotation.
      * function MarshalAs(options) {
      *     return (target, propertyKey) => { Reflect.definePropertyMetadata(target, propertyKey, MarshalAs, options); }
      * }
      * ```      
      */
    export function definePropertyMetadata(target: any, propertyKey: PropertyKey, metadataKey: any, metadata: any): void {
        let propertyMap = weakPropertyMetadata.get(target);
        if (!propertyMap) {
            propertyMap = new Map<PropertyKey, Map<any, any>>();
            weakPropertyMetadata.set(target, propertyMap);
        }

        let metadataMap = propertyMap.get(propertyKey);
        if (!metadataMap) {
            metadataMap = new Map<any, any>();
            propertyMap.set(propertyKey, metadataMap);
        }

        metadataMap.set(metadataKey, metadata);
    }

    /**
      * Gets a value indicating whether a property of the target object or its prototype chain has the provided metadata key defined.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata key was defined on a property of the target object or its prototype chain; otherwise, `false`.
      */
    export function hasPropertyMetadata(target: any, propertyKey: PropertyKey, metadataKey: any): boolean {
        while (target) {
            if (Reflect.hasOwnPropertyMetadata(target, propertyKey, metadataKey)) {
                return true;
            }
            target = Reflect.getPrototypeOf(target);
        }
        return false;
    }

    /**
      * Gets the first metadata value for the provided metadata key on a property of the target object or its prototype chain.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
      * @example
      * ```
      * let metadata = Reflect.getPropertyMetadata(target, propertyKey, MarshalAs);
      * ```
      */
    export function getPropertyMetadata(target: any, propertyKey: PropertyKey, metadataKey: any): any {
        while (target) {
            if (Reflect.hasOwnPropertyMetadata(target, propertyKey, metadataKey)) {
                return Reflect.getOwnPropertyMetadata(target, propertyKey, metadataKey);
            }
            target = Reflect.getPrototypeOf(target);
        }
        return undefined;
    }

    /**
      * Gets the metadata keys defined on a property of the target object or its prototype chain.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @returns An array of unique metadata keys.
      */
    export function getPropertyMetadataKeys(target: any, propertyKey: PropertyKey): any[] {
        let keySet = new Set<any>();
        let keys: any[] = [];
        while (target) {
            for (let key of Reflect.getOwnPropertyMetadataKeys(target)) {
                if (!keySet.has(key)) {
                    keySet.add(key);
                    keys.push(key);
                }
            }
            target = Reflect.getPrototypeOf(target);
        }
        return keys;
    }

    /**
      * Gets a value indicating whether a property of the target object has the provided metadata key defined.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata key was defined on the target object; otherwise, `false`.
      */
    export function hasOwnPropertyMetadata(target: any, propertyKey: PropertyKey, metadataKey: any): boolean {
        let propertyMap = weakPropertyMetadata.get(target);
        if (propertyMap) {
            let metadataMap = propertyMap.get(propertyKey);
            if (metadataMap) {
                return metadataMap.has(metadataKey);
            }
        }
        return false;
    }

    /**
      * Gets the metadata value for the provided metadata key on a property of the target object.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
      * @example
      * ```
      * let metadata = Reflect.getOwnPropertyMetadata(target, propertyKey, MarshalAs);
      * ```
      */
    export function getOwnPropertyMetadata(target: any, propertyKey: PropertyKey, metadataKey: any): any {
        let propertyMap = weakPropertyMetadata.get(target);
        if (propertyMap) {
            let metadataMap = propertyMap.get(propertyKey);
            if (metadataMap) {
                return metadataMap.get(metadataKey);
            }
        }
        return undefined;
    }

    /**
      * Gets the metadata keys defined on a property of the target object.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @returns An array of unique metadata keys.
      */
    export function getOwnPropertyMetadataKeys(target: any, propertyKey: PropertyKey): any[] {
        let propertyMap = weakPropertyMetadata.get(target);
        if (propertyMap) {
            let metadataMap = propertyMap.get(propertyKey);
            if (metadataMap) {
                return [...metadataMap.keys()];
            }
        }
        return [];
    }

    /**
      * Deletes the metadata from a property of the target object with the provided key.
      * @param target The target object on which the metadata is defined.
      * @param propertyKey The key of the property on the target.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata entry was found and deleted; otherwise, false.
      */
    export function deleteOwnPropertyMetadata(target: any, propertyKey: PropertyKey, metadataKey: any): boolean {
        let propertyMap = weakPropertyMetadata.get(target);
        if (propertyMap) {
            let metadataMap = propertyMap.get(propertyKey);
            if (metadataMap) {
                return metadataMap.delete(metadataKey);
            }
        }
        return false;
    }

    /**
      * Define a metadata entry on a parameter of the target function.
      * @param target The target function on which to define metadata.
      * @param parameterIndex The ordinal parameter index.
      * @param metadataKey A key used to store and retrieve metadata.
      * @param metadata A value that contains attached metadata.
      * @returns The target function.
      * @example
      * ```
      * // Inject decorator factory as metadata-producing annotation.
      * function Inject(type) {
      *     return (target, parameterIndex) => { Reflect.defineMetadata(target, parameterIndex, Inject, type); }
      * }
      * ```      
      */
    export function defineParameterMetadata(target: Function, parameterIndex: number, metadataKey: any, metadata: any): void {
        let parameterMap = weakParameterMetadata.get(target);
        if (!parameterMap) {
            parameterMap = new Map<number, Map<any, any>>();
            weakParameterMetadata.set(target, parameterMap);
        }

        let metadataMap = parameterMap.get(parameterIndex);
        if (!metadataMap) {
            metadataMap = new Map<any, any>();
            parameterMap.set(parameterIndex, metadataMap);
        }

        metadataMap.set(metadataKey, metadata);
    }

    /**
      * Gets a value indicating whether a parameter of the target function or its prototype chain has the provided metadata key defined.
      * @param target The target function on which the metadata is defined.
      * @param parameterIndex The ordinal parameter index.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata key was defined on a property of the target function or its prototype chain; otherwise, `false`.
      */
    export function hasParameterMetadata(target: Function, parameterIndex: number, metadataKey: any): boolean {
        let parameterMap = weakParameterMetadata.get(target);
        if (parameterMap) {
            let metadataMap = parameterMap.get(parameterIndex);
            if (metadataMap) {
                return metadataMap.has(metadataKey);
            }
        }
        return false;
    }

    /**
      * Gets the first occurance of metadata for the provided metadata key on a parameter of the target function.
      * @param target The target function on which the metadata is defined.
      * @param parameterIndex The ordinal parameter index.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
      * @example
      * ```
      * let metadata = Reflect.getParameterMetadata(target, parameterIndex, Inject);
      * ```
      */
    export function getParameterMetadata(target: Function, parameterIndex: number, metadataKey: any): any {
        let parameterMap = weakParameterMetadata.get(target);
        if (parameterMap) {
            let metadataMap = parameterMap.get(parameterIndex);
            if (metadataMap) {
                return metadataMap.get(metadataKey);
            }
        }
        return undefined;
    }

    /**
      * Gets the unique metadata keys defined on a parameter of the target function.
      * @param target The target function on which the metadata is defined.
      * @param parameterIndex The ordinal parameter index.
      * @returns An array of unique metadata keys.
      */
    export function getParameterMetadataKeys(target: Function, parameterIndex: number): any[] {
        let parameterMap = weakParameterMetadata.get(target);
        if (parameterMap) {
            let metadataMap = parameterMap.get(parameterIndex);
            if (metadataMap) {
                return [...metadataMap.keys()];
            }
        }
        return [];
    }

    /**
      * Deletes the metadata from a parameter of the target function with the provided key.
      * @param target The target function on which the metadata is defined.
      * @param parameterIndex The ordinal parameter index.
      * @param metadataKey A key used to store and retrieve metadata.
      * @returns `true` if the metadata entry was found and deleted; otherwise, false.
      */
    export function deleteParameterMetadata(target: Function, parameterIndex: number, metadataKey: any): boolean {
        let parameterMap = weakParameterMetadata.get(target);
        if (parameterMap) {
            let metadataMap = parameterMap.get(parameterIndex);
            if (metadataMap) {
                return metadataMap.delete(metadataKey);
            }
        }
        return undefined;
    }
}
