import OBR, { Item, Image, ItemFilter, Path } from "@owlbear-rodeo/sdk";
import Coloris from "@melloware/coloris";
import { SMOKEMAIN } from "./smokeMain";
import { Constants } from "./utilities/bsConstants";
import { isTrailingFog, isVisionLine } from "./utilities/itemFilters";
import { importFog, ImportScene } from "./tools/import";
import { AddBorderIfNoAutoDetect } from "./smokeVisionUI";
import { SetupAutohideMenus } from "./smokeSetupContextMenus";
import { BSCACHE } from "./utilities/bsSceneCache";

export function SetupPanelHandlers()
{
    SMOKEMAIN.smokeViewToggle!.onclick = (e) =>
    {
        e.preventDefault();
        TogglePanel(SMOKEMAIN.smokeViewToggle!, SMOKEMAIN.smokeViewPanel!);
    };

    SMOKEMAIN.spectreViewToggle!.onclick = (e) =>
    {
        e.preventDefault();
        TogglePanel(SMOKEMAIN.spectreViewToggle!, SMOKEMAIN.spectreViewPanel!);
    };

    SMOKEMAIN.settingsViewToggle!.onclick = (e) =>
    {
        e.preventDefault();
        TogglePanel(SMOKEMAIN.settingsViewToggle!, SMOKEMAIN.settingsViewPanel!);
    };

    SMOKEMAIN.debugViewToggle!.onclick = (e) =>
    {
        e.preventDefault();
        TogglePanel(SMOKEMAIN.debugViewToggle!, SMOKEMAIN.debugViewPanel!);
    };

    function TogglePanel(button: HTMLButtonElement, panel: HTMLDivElement)
    {
        SMOKEMAIN.smokeViewToggle?.classList.remove("selected");
        SMOKEMAIN.spectreViewToggle?.classList.remove("selected");
        SMOKEMAIN.settingsViewToggle?.classList.remove("selected");
        SMOKEMAIN.debugViewToggle?.classList.remove("selected");

        SMOKEMAIN.smokeViewPanel!.style.display = "none";
        SMOKEMAIN.spectreViewPanel!.style.display = "none";
        SMOKEMAIN.settingsViewPanel!.style.display = "none";
        SMOKEMAIN.debugViewPanel!.style.display = "none";

        button.classList.add("selected");
        panel.style.display = "block";
    }
}

export function SetupInputHandlers()
{
    // Indicator for everyone processing fully
    SMOKEMAIN.processedIndicator!.onclick = async () =>
    {
        await OBR.popover.open({
            id: Constants.PROCESSEDID,
            url: `/pages/processed.html`,
            height: 300,
            width: 320,
            disableClickAway: false
        });
    };

    SMOKEMAIN.hiddenListToggle!.onclick = async (event: MouseEvent) =>
    {
        if (SMOKEMAIN.hiddenTable!.style.display === "none")
        {
            SMOKEMAIN.hiddenTable!.style.display = "table-row-group";
            SMOKEMAIN.hiddenListToggle!.value = "Out-of-Sight List: Click to Hide";
        }
        else
        {
            SMOKEMAIN.hiddenTable!.style.display = "none";
            SMOKEMAIN.hiddenListToggle!.value = "Out-of-Sight List: Click to Show";
        }
    }

    // The visionCheckbox element is responsible for toggling vision updates
    SMOKEMAIN.visionCheckbox!.onclick = async (event: MouseEvent) =>
    {
        if (!BSCACHE.sceneReady)
        {
            event.preventDefault();
            return;
        }

        const target = event.target as HTMLInputElement;

        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/visionEnabled`]: target.checked });
        await OBR.scene.fog.setFilled(target.checked);
    };

    // This is for the grid-snap option
    SMOKEMAIN.snapCheckbox!.checked = true;
    SMOKEMAIN.snapCheckbox!.onclick = async (event: MouseEvent) =>
    {
        if (!BSCACHE.sceneReady)
        {
            event.preventDefault();
            return;
        }

        const target = event.target as HTMLInputElement;
        BSCACHE.snap = target.checked;
    };

    // Toggles the persistence mode
    SMOKEMAIN.persistenceCheckbox!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/persistenceEnabled`]: target.checked });
    };

    // Toggles the auto-detect maps option
    SMOKEMAIN.autodetectCheckbox!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/autodetectEnabled`]: target.checked });
        SMOKEMAIN.boundryOptions!.style.display = target.checked ? 'none' : '';

        await AddBorderIfNoAutoDetect();
    };

    // Toggles Fog of War - Trailing Fog
    SMOKEMAIN.fowCheckbox!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        await SetupAutohideMenus(target.checked);
        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/fowEnabled`]: target.checked });
    };

    // Toggles showing players the Door icons
    SMOKEMAIN.doorCheckbox!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/playerDoors`]: target.checked });
    };

    // Resets the map's persistence
    SMOKEMAIN.resetButton!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;

        OBR.broadcast.sendMessage(Constants.RESETID, true, { destination: "ALL" });
    };

    SMOKEMAIN.unlockFogButton!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const allFogLines = BSCACHE.sceneItems.filter(x => (isVisionLine(x)));

        await BSCACHE.ToggleBusy(true);

        for (let i = 0; i < allFogLines.length; i += 64)
        {
            const batch = allFogLines.slice(i, i + 64);
            await OBR.scene.items.updateItems(batch, (paths) =>
            {
                for (let path of paths)
                {
                    path.locked = false;
                }
            });
        }
        await BSCACHE.ToggleBusy(false);
    };

    SMOKEMAIN.lockFogButton!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const allFogLines = BSCACHE.sceneItems.filter(x => (isVisionLine(x)));

        await BSCACHE.ToggleBusy(true);

        for (let i = 0; i < allFogLines.length; i += 64)
        {
            const batch = allFogLines.slice(i, i + 64);
            await OBR.scene.items.updateItems(batch, (paths) =>
            {
                for (let path of paths)
                {
                    path.locked = true;
                }
            });
        }
        await BSCACHE.ToggleBusy(false);
    };

    // Also have no idea on what this one is.
    SMOKEMAIN.backgroundButton!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        await OBR.scene.items.updateItems((item: Item) => { return item.layer == "FOG" && (item.metadata[`${Constants.EXTENSIONID}/isBackgroundMap`] === true) }, (items: Item[]) =>
        {
            for (let i = 0; i < items.length; i++)
            {
                items[i].layer = "MAP";
                items[i].disableHit = false;
                items[i].locked = false;
                items[i].visible = true;
                delete items[i].metadata[`${Constants.EXTENSIONID}/isBackgroundMap`];
            }
        });
    };

    // Changes the fog of war color.
    let debouncer: ReturnType<typeof setTimeout>;
    SMOKEMAIN.fowColor!.onclick = () =>
    {
        Coloris({
            el: `#${SMOKEMAIN.fowColor!.id}`,
            alpha: true,
            forceAlpha: true,
        });
    };
    SMOKEMAIN.fowColor!.oninput = async (event: Event) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        clearTimeout(debouncer);

        // Debounce this input to avoid hitting OBR rate limit
        debouncer = setTimeout(async () =>
        {
            //let fowColor = "#000000";
            const fogRegex = /#[a-f0-9]{8}/
            if (fogRegex.test(target.value))
            {
                // Remove existing fog, will be regenerated on update:

                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/fowColor`]: target.value });

                const fogItems = await OBR.scene.local.getItems(isTrailingFog as ItemFilter<Image>) as Image[];
                await OBR.scene.local.deleteItems(fogItems.map(fogItem => fogItem.id));
            }
        }, 500);

    };

    // Converts dynamic fog maps to Smoke.
    SMOKEMAIN.convertButton!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;

        if (window.confirm("WARNING: THIS CANNOT BE UNDONE.\n\nThis operation will remove all metadata from the original dynamic fog extension, and will break fog lines and other things if you do not continue using Smoke!.\n\nWARNING: THIS CANNOT BE UNDONE.\n\nAre you REALLY sure?"))
        {
            for (const meta in BSCACHE.sceneMetadata)
            {
                // Remove the old scene metadata, we dont need any of it
                if (meta.substring(0, meta.indexOf('/')) == Constants.ARMINDOID)
                {
                    await OBR.scene.setMetadata({ [`${meta}`]: undefined });
                }
            }

            await OBR.scene.items.updateItems(BSCACHE.sceneItems, items =>
            {
                for (const item of items)
                {
                    if (item.metadata[`${Constants.ARMINDOID}/isVisionLine`] !== undefined)
                    {
                        item.metadata[`${Constants.EXTENSIONID}/isVisionLine`] = item.metadata[`${Constants.ARMINDOID}/isVisionLine`];
                        delete item.metadata[`${Constants.ARMINDOID}/isVisionLine`];
                    }
                    if (item.metadata[`${Constants.ARMINDOID}/disabled`] !== undefined)
                    {
                        item.metadata[`${Constants.EXTENSIONID}/disabled`] = item.metadata[`${Constants.ARMINDOID}/disabled`];
                        delete item.metadata[`${Constants.ARMINDOID}/disabled`];
                    }
                }
            });
        }
    };

    // TODO: this is a hack, need to pass json between different event handlers
    var importObject: any;

    SMOKEMAIN.importFile!.onchange = (event: Event) =>
    {
        type FileEventTarget = EventTarget & { files: FileList };
        SMOKEMAIN.importButton!.disabled = true;

        if (!event || !event.target) return;
        const target = event.target as FileEventTarget;

        if (!target.files) return;
        const file = target.files[0];

        if (file.type !== "text/javascript" && file.type !== "application/x-javascript")
        {
            // do we care about the mime type? this is likely browser specific, or file specific, so just ignore it for now.
            // importErrors.innerText = "Wrong file type " + file.type;
            // return;
        }

        if (file)
        {
            type ReadFileTarget = EventTarget & { result: string };
            var readFile = new FileReader();
            readFile.onload = function (event: Event)
            {
                if (!event || !event.target)
                {
                    SMOKEMAIN.importErrors!.innerText = "Invalid import event";
                    return;
                }
                const target = event.target as ReadFileTarget;
                if (!target.result)
                {
                    SMOKEMAIN.importErrors!.innerText = "Unable to read imported file";
                    return;
                }
                const fileContent = target.result;
                importObject = JSON.parse(fileContent);

                // do we really need to validate this here? can do it inside the import functions for each vtt
                if (importObject && ((importObject.walls && importObject.walls.length)
                    || (importObject.line_of_sight && importObject.line_of_sight.length)
                    || (importObject.objects_line_of_sight && importObject.objects_line_of_sight.length)))
                {
                    // Good to go:
                    SMOKEMAIN.importButton!.disabled = false;
                } else
                {
                    SMOKEMAIN.importErrors!.innerText = "Imported file has no walls";
                }
            };
            readFile.readAsText(file);
        } else
        {
            SMOKEMAIN.importErrors!.innerText = "Failed to load file";
        }
    };

    SMOKEMAIN.dpiAutodetect!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;
        SMOKEMAIN.importDpi!.disabled = SMOKEMAIN.dpiAutodetect!.checked;
    };

    SMOKEMAIN.importButton!.onclick = async (event: MouseEvent) =>
    {
        if (!event || !event.target) return;

        await BSCACHE.ToggleBusy(true);
        if (SMOKEMAIN.importFormat!.value === "scene")
        {
            await ImportScene(importObject, SMOKEMAIN.importErrors!);
        }
        else
        {
            await importFog(SMOKEMAIN.importFormat!.value, importObject, (SMOKEMAIN.dpiAutodetect!.checked ? 0 : Number.parseInt(SMOKEMAIN.importDpi!.value)), SMOKEMAIN.mapAlign!.value, SMOKEMAIN.importErrors!);
        }
        await BSCACHE.ToggleBusy(false);
    };

    // Tool Option Handling - Tool Color
    SMOKEMAIN.toolColor!.onclick = async (_event: MouseEvent) =>
    {
        Coloris({
            el: `#${SMOKEMAIN.toolColor!.id}`,
            alpha: false,
            forceAlpha: false,
        });
    };

    SMOKEMAIN.toolColor!.oninput = async (event: Event) =>
    {
        if (!event || !event.target) return;
        const target = event.target as HTMLInputElement;

        clearTimeout(debouncer);

        // Debounce this input to avoid hitting OBR rate limit
        debouncer = setTimeout(async () =>
        {
            const hexTest = /#[a-f0-9]{6}/
            if (hexTest.test(target.value))
            {
                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/toolColor`]: target.value });
            }
        }, 400);

    };

    SMOKEMAIN.toolStyle!.onchange = async (event) =>
    {
        const target = event.currentTarget as HTMLSelectElement;

        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/toolStyle`]: target.value == "solid" ? [] : [25, 25] });
    };

    SMOKEMAIN.toolWidth!.onchange = (event) =>
    {
        const target = event.currentTarget as HTMLInputElement;
        clearTimeout(debouncer);

        // Debounce this input to avoid hitting OBR rate limit
        debouncer = setTimeout(async () =>
        {

            await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/toolWidth`]: target.value });
        }, 400);
    };

    SMOKEMAIN.defaultMELDepth!.onchange = (event) =>
    {
        const target = event.currentTarget as HTMLInputElement;
        clearTimeout(debouncer);

        // Debounce this input to avoid hitting OBR rate limit
        debouncer = setTimeout(async () =>
        {
            await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/defaultMELDepth`]: target.value });
        }, 400);
    };

    SMOKEMAIN.whatsNewButton!.onclick = async function ()
    {
        SMOKEMAIN.whatsNewIcon?.classList.remove("new-shine");
        await OBR.modal.open({
            id: Constants.EXTENSIONWHATSNEW,
            url: `/pages/whatsnew.html`,
            height: 500,
            width: 400,
        });
    };

    // Need to retrieve the colors and set them on the element before initialization for the Thumbnails to update correctly.
    const getFowColor = BSCACHE.sceneMetadata[`${Constants.EXTENSIONID}/fowColor`] as string ?? "#00000088";
    const getToolColor = BSCACHE.sceneMetadata[`${Constants.EXTENSIONID}/toolColor`] as string ?? "#000000";
    SMOKEMAIN.toolColor!.value = getToolColor;
    SMOKEMAIN.fowColor!.value = getFowColor;
    Coloris({
        themeMode: 'dark',
        alpha: true,
        forceAlpha: true,
        el: "#fow_color",
        defaultColor: getFowColor
    });

    Coloris({
        themeMode: 'dark',
        alpha: false,
        forceAlpha: false,
        el: "#tool_color",
        defaultColor: getToolColor
    });
}