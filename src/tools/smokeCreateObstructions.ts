import { Vector2, MathM, Math2, Player } from "@owlbear-rodeo/sdk";
import { Constants } from "../utilities/bsConstants";
import { isTorch } from "../utilities/itemFilters";
import { comparePosition, squareDistance, isClose, mod } from "../utilities/math";
import { BSCACHE } from "../utilities/bsSceneCache";
import { isPointInPolygon } from "../utilities/bsUtilities";

function CheckLineOcclusionByPoly(line: Vector2[], poly: Vector2[]): boolean
{
    if (Math2.pointInPolygon(line[0], poly) || Math2.pointInPolygon(line[0], poly))
    {
        return true;
    }

    return LineIntersect(line, [poly[0], poly[1]]) || LineIntersect(line, [poly[1], poly[2]]) || LineIntersect(line, [poly[2], poly[3]]) || LineIntersect(line, [poly[3], poly[0]]);
}

function LineIntersect(l1: Vector2[], l2: Vector2[]): boolean
{
    const det = (l1[1].x - l1[0].x) * (l2[1].y - l2[0].y) - (l2[1].x - l2[0].x) * (l1[1].y - l1[0].y);
    const a = ((l2[1].y - l2[0].y) * (l2[1].x - l1[0].x) + (l2[0].x - l2[1].x) * (l2[1].y - l1[0].y)) / det;
    const b = ((l1[0].y - l1[1].y) * (l2[1].x - l1[0].x) + (l1[1].x - l1[0].x) * (l2[1].y - l1[0].y)) / det;

    return a >= 0 && a <= 1 && b >= 0 && b <= 1;
}

// find either side of the circle from the perspective of a given angle
function CalculatePointOnCircle(center: Vector2, radius: number, angle: number): Vector2
{
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

// create a rect that starts at p1*radius and extends around the p2*radius
function GetRectFromPoints(p1: Vector2, r1: number, p2: Vector2, r2: number): Vector2[]
{
    const angle = Math.atan2(p1.y - p2.y, p1.x - p2.x);

    let p1p1 = CalculatePointOnCircle(p1, r1, angle + Math.PI / 2);
    let p1p2 = CalculatePointOnCircle(p1, r1, angle - Math.PI / 2);
    let p2p1 = CalculatePointOnCircle(p2, r2, angle + Math.PI / 2);
    let p2p2 = CalculatePointOnCircle(p2, r2, angle - Math.PI / 2);

    const direction: Vector2 = Math2.normalize(Math2.subtract(p1, p2));
    p1p1 = Math2.add(p1p1, Math2.multiply(direction, r1));
    p1p2 = Math2.add(p1p2, Math2.multiply(direction, r1));

    p2p1 = Math2.add(p2p1, Math2.multiply(direction, 0 - r2));
    p2p2 = Math2.add(p2p2, Math2.multiply(direction, 0 - r2));

    return [p1p1, p1p2, p2p2, p2p1];
}

export function CreateObstructionLines(visionShapes: any): ObstructionLine[]
{
    return visionShapes
        .filter((shape: any) => shape.points && shape.points.length > 1)
        .flatMap((shape: any) =>
        {
            const shapeTransform = MathM.fromItem(shape);

            return shape.points.slice(0, -1).map((_: any, i: any) =>
            {
                const startTransform = MathM.fromPosition(shape.points[i]);
                const endTransform = MathM.fromPosition(shape.points[i + 1]);

                const start = MathM.decompose(MathM.multiply(shapeTransform, startTransform)).position;
                const end = MathM.decompose(MathM.multiply(shapeTransform, endTransform)).position;

                return {
                    startPosition: start,
                    endPosition: end,
                    originalShape: shape,
                    oneSided: shape.metadata[`${Constants.EXTENSIONID}/oneSided`]
                };
            });
        });
}

export function CreatePolygons(visionLines: ObstructionLine[], tokensWithVision: any, width: number, height: number, offset: [number, number], scale: [number, number]): Polygon[][]
{
    const BASEMELDEPTH = parseInt(BSCACHE.sceneMetadata[`${Constants.EXTENSIONID}/defaultMELDepth`] as string ?? "0");
    let polygons: Polygon[][] = [];
    let lineCounter = 0, skipCounter = 0;
    let size = [width, height];
    const elevationMappings = BSCACHE.sceneMetadata[`${Constants.EXTENSIONID}/elevationMapping`] as ElevationMap[] ?? [];

    const corners = [
        { x: (width + offset[0]) * scale[0], y: offset[1] * scale[1] },
        { x: (width + offset[0]) * scale[0], y: (height + offset[1]) * scale[1] },
        { x: offset[0] * scale[0], y: (height + offset[1]) * scale[1] },
        { x: offset[0] * scale[0], y: offset[1] * scale[1] },
    ];

    // Precompute constants
    const gridDpi = BSCACHE.gridDpi;
    const extensionId = Constants.EXTENSIONID;

    const sceneHasTorches = tokensWithVision.some(isTorch);

    // Now witness the firepower of this fully armed and operational battlestation:
    // let cullingDebugPath;
    // if (BSCACHE.enableVisionDebug)
    // {
    //     cullingDebugPath = PathKit.NewPath();
    // }

    if (tokensWithVision.length === 0)
    {
        return polygons;
    }
    
    for (const token of tokensWithVision)
    {
        const myToken = (BSCACHE.playerId === token.createdUserId);
        const tokenOwner = BSCACHE.sceneMetadata[`${Constants.EXTENSIONID}/USER-${token.createdUserId}`] as Player;
        const gmToken = tokenOwner?.role === "GM";

        let tokenDepth;
        for (const mapping of elevationMappings)
        {
            const withinMap = isPointInPolygon(token.position, mapping.Points);
            if (withinMap)
            {
                if (withinMap && (tokenDepth === undefined || mapping.Depth > tokenDepth))
                {
                    tokenDepth = mapping.Depth;
                }
            }
        }

        if (tokenDepth === undefined) tokenDepth = BASEMELDEPTH;

        if ((!myToken && BSCACHE.playerRole !== "GM") && !gmToken)
        {
            continue;
        }

        const visionRangeMeta = token.metadata[`${extensionId}/visionRange`];
        const cacheResult = BSCACHE.playerShadowCache.getValue(token.id);
        polygons.push([]);

        if (cacheResult !== undefined && comparePosition(cacheResult.player.position, token.position) && cacheResult.player.metadata[`${extensionId}/visionRange`] === visionRangeMeta)
        {
            continue; // The result is cached and will be used later, no need to do work
        }

        // use the token vision range to potentially skip any obstruction lines out of range:
        let visionRange = gridDpi * 1000; // Default value

        if (visionRangeMeta)
        {
            visionRange = gridDpi * ((visionRangeMeta) / BSCACHE.gridScale + 0.5);
        }

        const torchBounds: Vector2[][] = [];
        if (sceneHasTorches && !isTorch(token))
        {
            for (const torch of tokensWithVision)
            {
                if (isTorch(torch))
                {
                    const torchVisionRangeMeta = torch.metadata[`${Constants.EXTENSIONID}/visionRange`];

                    // use the token vision range to potentially skip any obstruction lines out of range:
                    let torchVisionRange = 1000 * BSCACHE.gridDpi;
                    if (torchVisionRangeMeta)
                    {
                        torchVisionRange = BSCACHE.gridDpi * ((torchVisionRangeMeta) / BSCACHE.gridScale + .5);
                    }

                    // Create the bounds of the torch and scale the occlusion radius slightly:
                    const torchBoundingRect = GetRectFromPoints(token.position, visionRange, torch.position, torchVisionRange);
                    torchBounds.push(torchBoundingRect);

                    // if (BSCACHE.enableVisionDebug)
                    // {
                    //     let path = PathKit.NewPath();
                    //     path.moveTo(torchBoundingRect[0].x, torchBoundingRect[0].y)
                    //         .lineTo(torchBoundingRect[1].x, torchBoundingRect[1].y)
                    //         .lineTo(torchBoundingRect[2].x, torchBoundingRect[2].y)
                    //         .lineTo(torchBoundingRect[3].x, torchBoundingRect[3].y)
                    //         .closePath();

                    //     const debugPath = buildPath().fillRule("evenodd").commands(path.toCmds()).locked(true).visible(true).fillColor('#660000').strokeColor("#FF0000").fillOpacity(0.2).layer("DRAWING").metadata({ [`${Constants.EXTENSIONID}/debug`]: true }).build();
                    //     OBR.scene.local.addItems([debugPath]);
                    //     path.delete();
                    // }
                }
            }
        }

        for (const line of visionLines)
        {
            let lineDepth;
            for (const mapping of elevationMappings)
            {
                const withinMap = isPointInPolygon(line.startPosition, mapping.Points);
                if (withinMap)
                {
                    if (withinMap && (lineDepth === undefined || mapping.Depth > tokenDepth))
                    {
                        lineDepth = mapping.Depth;
                    }
                }
            }

            if (lineDepth === undefined) lineDepth = BASEMELDEPTH;

            if (tokenDepth > lineDepth) continue;

            const signedDistance = (token.position.x - line.startPosition.x) * (line.endPosition.y - line.startPosition.y) - (token.position.y - line.startPosition.y) * (line.endPosition.x - line.startPosition.x);

            if (line.oneSided !== undefined)
            {
                if ((line.oneSided === "right" && signedDistance > 0) || (line.oneSided === "left" && signedDistance < 0))
                    continue;
            }

            let lsx = line.startPosition.x, lsy = line.startPosition.y, lex = line.endPosition.x, ley = line.endPosition.y;

            if (lsx < offset[0] || lsy < offset[1] || lsx > offset[0] + size[0] || lsy > offset[1] + size[1]
                || lex < offset[0] || ley < offset[1] || lex > offset[0] + size[0] || ley > offset[1] + size[1])
            {
                // Adjust the start position to be within the bounds
                lsx = Math.max(offset[0], Math.min(lsx, offset[0] + size[0]));
                lsy = Math.max(offset[1], Math.min(lsy, offset[1] + size[1]));
                line.startPosition = clipLineToBoundingBox(line, offset, size).startPosition;
                line.endPosition = clipLineToBoundingBox(line, offset, size).endPosition;
            }

            // exclude lines based on distance.. this is faster than creating polys around everything, but is less accurate, particularly on long lines. we compensate for this by adjusting the detection by 5% of the vision range.
            const segments: Vector2[] = [line.startPosition, line.endPosition];
            const length = Math2.distance(line.startPosition, line.endPosition);
            const segmentFactor = 3; // this causes load but increases accuracy, because we calculate maxSegments as a proportion of the visionRange divided by the segment factor to increase resolution
            const maxSegments = Math.floor(length / (visionRange / segmentFactor));

            for (let i = 1; i < maxSegments; i++)
            {
                segments.push(Math2.lerp(line.startPosition, line.endPosition, (i / maxSegments)));
            }

            let skip = true;
            for (const segment of segments)
            {
                // add 5% to the visionRange as a precaution:
                if (Math2.compare(token.position, segment, visionRange * 1.05))
                {
                    skip = false;
                    break;
                }
            };


            // if the token we're calculating is not a torch, then check torch occlusion based on the bounding triangles
            if (skip && sceneHasTorches && !isTorch(token))
            {
                for (const bounds of torchBounds)
                {
                    if (CheckLineOcclusionByPoly([line.startPosition, line.endPosition], bounds))
                    {
                        skip = false;
                        break;
                    }
                }
            }

            if (skip)
            {
                // if (BSCACHE.enableVisionDebug)
                // {
                //     cullingDebugPath.moveTo(line.startPosition.x, line.startPosition.y).lineTo(line.endPosition.x, line.endPosition.y);
                // }
                skipCounter++;
                continue;
            }

            lineCounter++;

            // *1st step* - compute the points in the polygon representing the shadow
            // cast by `line` from the point of view of `player`.

            const v1 = { x: line.startPosition.x - token.position.x, y: line.startPosition.y - token.position.y };
            const v2 = { x: line.endPosition.x - token.position.x, y: line.endPosition.y - token.position.y };

            var proj1 = { x: 0, y: 0 }, proj2 = { x: 0, y: 0 };
            var xlim1 = 0, ylim1 = 0, xlim2 = 0, ylim2 = 0;

            // Make sure we don't go past the image borders
            if (v1.x < 0) xlim1 = offset[0] * scale[0];
            else xlim1 = (width + offset[0]) * scale[0];
            if (v1.y < 0) ylim1 = offset[1] * scale[1];
            else ylim1 = (height + offset[1]) * scale[1];
            if (v2.x < 0) xlim2 = offset[0] * scale[0];
            else xlim2 = (width + offset[0]) * scale[0];
            if (v2.y < 0) ylim2 = offset[1] * scale[1];
            else ylim2 = (height + offset[1]) * scale[1];

            const options1 = [], options2 = [];
            if (v1.x != 0)
            {
                const m = v1.y / v1.x;
                const b = line.startPosition.y - m * line.startPosition.x;
                options1.push({ x: xlim1, y: m * xlim1 + b });
            }
            if (v1.y != 0)
            {
                const n = v1.x / v1.y;
                const c = n * line.startPosition.y - line.startPosition.x;
                options1.push({ x: n * ylim1 - c, y: ylim1 });
            }
            if (v2.x != 0)
            {
                const m = v2.y / v2.x;
                const b = line.endPosition.y - m * line.endPosition.x;
                options2.push({ x: xlim2, y: m * xlim2 + b });
            }
            if (v2.y != 0)
            {
                const n = v2.x / v2.y;
                const c = n * line.endPosition.y - line.endPosition.x;
                options2.push({ x: n * ylim2 - c, y: ylim2 });
            }

            if (options1.length === 0 || options2.length === 0)
            {
                continue;
            }

            if (options1.length == 1 || squareDistance(options1[0], line.startPosition) < squareDistance(options1[1], line.startPosition))
                proj1 = options1[0];
            else
                proj1 = options1[1];

            if (options2.length == 1 || squareDistance(options2[0], line.endPosition) < squareDistance(options2[1], line.endPosition))
                proj2 = options2[0];
            else
                proj2 = options2[1];

            const pointset = [
                { x: line.startPosition.x, y: line.startPosition.y },
                proj1,
                proj2,
                { x: line.endPosition.x, y: line.endPosition.y },
            ];

            // Find out in which edge each solution lies
            const edges = [0, 0];
            let i = 0;
            for (const proj of [proj1, proj2])
            {
                if (isClose(proj.y, offset[1] * scale[1]))
                    edges[i] = 0;
                else if (isClose(proj.y, (height + offset[1]) * scale[1]))
                    edges[i] = 2;
                else if (isClose(proj.x, offset[0] * scale[0]))
                    edges[i] = 3;
                else if (isClose(proj.x, (width + offset[0]) * scale[0]))
                    edges[i] = 1;

                i++;
            }

            let direction = Math.sign(signedDistance);
            direction = direction == 0 ? 1 : -direction;
            const last = direction == 1 ? edges[1] : mod(edges[1] - 1, 4);
            for (let k = edges[0] + (direction == 1 ? 0 : -1); mod(k, 4) != last; k += direction)
            {
                pointset.splice(pointset.length - 2, 0, corners[mod(k, 4)]);
            }

            polygons[polygons.length - 1].push({ pointset: pointset, fromShape: line.originalShape });
        }
    }

    // if (BSCACHE.enableVisionDebug)
    // {
    //     console.log('skip', skipCounter, 'lines', lineCounter);

    //     const debugPath = buildPath().commands(cullingDebugPath.toCmds()).visible(true).locked(true).strokeColor("#00FF00").fillOpacity(0).layer("DRAWING").name("smokedebug").metadata({ [`${Constants.EXTENSIONID}/debug`]: true }).build();
    //     OBR.scene.local.addItems([debugPath]);

    //     cullingDebugPath.delete();
    // }

    return polygons;
}

function clipLineToBoundingBox(line: any, offset: any, size: any)
{
    let { x: lsx, y: lsy } = line.startPosition;
    let { x: lex, y: ley } = line.endPosition;

    let m = (ley - lsy) / (lex - lsx);
    let b = lsy - m * lsx;

    let intersections = [];

    // Top side
    if (lsy < offset[1])
    {
        let intersectionX = (offset[1] - b) / m;
        if (intersectionX >= offset[0] && intersectionX <= offset[0] + size[0])
        {
            intersections.push({ x: intersectionX, y: offset[1] });
        }
    }

    // Bottom side
    if (lsy > offset[1] + size[1])
    {
        let intersectionX = (offset[1] + size[1] - b) / m;
        if (intersectionX >= offset[0] && intersectionX <= offset[0] + size[0])
        {
            intersections.push({ x: intersectionX, y: offset[1] + size[1] });
        }
    }

    // Left side
    if (lsx < offset[0])
    {
        let intersectionY = m * offset[0] + b;
        if (intersectionY >= offset[1] && intersectionY <= offset[1] + size[1])
        {
            intersections.push({ x: offset[0], y: intersectionY });
        }
    }

    // Right side
    if (lsx > offset[0] + size[0])
    {
        let intersectionY = m * (offset[0] + size[0]) + b;
        if (intersectionY >= offset[1] && intersectionY <= offset[1] + size[1])
        {
            intersections.push({ x: offset[0] + size[0], y: intersectionY });
        }
    }

    intersections.sort((a, b) =>
    {
        let distA = Math.sqrt((a.x - lsx) ** 2 + (a.y - lsy) ** 2);
        let distB = Math.sqrt((b.x - lsx) ** 2 + (b.y - lsy) ** 2);
        return distA - distB;
    });

    let newStart = intersections.length > 0 ? intersections[0] : { x: lsx, y: lsy };
    let newEnd = intersections.length > 0 ? intersections[intersections.length - 1] : { x: lex, y: ley };

    let newLine = {
        startPosition: newStart,
        endPosition: newEnd
    };

    return newLine;
}
