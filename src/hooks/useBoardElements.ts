import { useState, useCallback } from 'react';
import type { BoardElementDto } from '../types/board.types';

export interface BoardElement {
    id: string;
    type: 'text' | 'image';
    x: number;
    y: number;
    width?: number;
    height?: number;
    content: string; // text content or base64 image data
}

export const useBoardElements = (
    onElementAdded?: (element: BoardElementDto) => void,
    onCleared?: () => void
) => {
    const [elements, setElements] = useState<BoardElement[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [tempTextPos, setTempTextPos] = useState({ x: 0, y: 0 });

    const addElement = useCallback((element: BoardElement, isRemote = false) => {
        setElements(prev => [...prev, element]);
        if (!isRemote && onElementAdded) {
            onElementAdded({
                id: element.id,
                type: element.type,
                x: element.x,
                y: element.y,
                content: element.content,
                color: '#000000',
                size: 24,
            });
        }
    }, [onElementAdded]);

    const addImage = useCallback((base64: string, x: number, y: number, isRemote = false, remoteId?: string) => {
        const id = isRemote ? (remoteId || Date.now().toString()) : Date.now().toString();
        addElement({ id, type: 'image', x, y, content: base64 }, isRemote);
    }, [addElement]);

    const addText = useCallback((text: string, x: number, y: number, isRemote = false, remoteId?: string) => {
        if (!text.trim()) return;
        const id = isRemote ? (remoteId || Date.now().toString()) : Date.now().toString();
        addElement({ id, type: 'text', x, y, content: text }, isRemote);
    }, [addElement]);

    /**
     * Updates position and/or size of an existing element (used by drag-and-drop / resize).
     * @param isRemote - if true, skip broadcasting (already came from WS)
     */
    const updateElement = useCallback((
        id: string,
        patch: Partial<Pick<BoardElement, 'x' | 'y' | 'width' | 'height'>>,
        isRemote = false
    ) => {
        setElements(prev =>
            prev.map(el => el.id === id ? { ...el, ...patch } : el)
        );
        return isRemote; // callers can use the return to decide broadcasting
    }, []);

    const clearElements = useCallback((isRemote = false) => {
        setElements([]);
        if (!isRemote && onCleared) {
            onCleared();
        }
    }, [onCleared]);

    const startTyping = useCallback((x: number, y: number) => {
        setTempTextPos({ x, y });
        setIsTyping(true);
    }, []);

    const finishTyping = useCallback((text: string) => {
        addText(text, tempTextPos.x, tempTextPos.y);
        setIsTyping(false);
    }, [addText, tempTextPos]);

    const cancelTyping = useCallback(() => {
        setIsTyping(false);
    }, []);

    return {
        elements,
        isTyping,
        tempTextPos,
        addImage,
        addText,
        updateElement,
        startTyping,
        finishTyping,
        cancelTyping,
        clearElements,
    };
};
