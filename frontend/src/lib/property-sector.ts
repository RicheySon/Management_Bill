export type PropertyKind = 'RESIDENTIAL' | 'BUSINESS_PROPERTY';

export function sectorFromPath(pathname: string | null | undefined): {
    kind: PropertyKind;
    basePath: string;
    label: string;
    shortLabel: string;
    billApiType: 'PROPERTY_RATE' | 'BUSINESS_PROPERTY';
    listTitle: string;
    listSubtitle: string;
    registerTitle: string;
    registerSubtitle: string;
    sectionTitle: string;
} {
    if (pathname?.startsWith('/business-properties')) {
        return {
            kind: 'BUSINESS_PROPERTY',
            basePath: '/business-properties',
            label: 'Business Property',
            shortLabel: 'Business Property',
            billApiType: 'BUSINESS_PROPERTY',
            listTitle: 'Business Properties',
            listSubtitle: 'Building rates for business / commercial properties (distinct from BOP)',
            registerTitle: 'New Business Property',
            registerSubtitle: 'Register a business property building with rate payer details',
            sectionTitle: 'Business Property Information',
        };
    }

    return {
        kind: 'RESIDENTIAL',
        basePath: '/properties',
        label: 'Property',
        shortLabel: 'Residential Property',
        billApiType: 'PROPERTY_RATE',
        listTitle: 'Residential Properties',
        listSubtitle: 'Manage residential property rates (buildings people live in)',
        registerTitle: 'New Residential Property',
        registerSubtitle: 'Register a residential property with rate payer details',
        sectionTitle: 'Property Information',
    };
}

export function propertyDetailHref(property: { id: string; property_kind?: string }) {
    return property.property_kind === 'BUSINESS_PROPERTY'
        ? `/business-properties/${property.id}`
        : `/properties/${property.id}`;
}
