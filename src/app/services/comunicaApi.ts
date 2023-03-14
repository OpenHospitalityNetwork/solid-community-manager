import { QueryEngine } from '@comunica/query-sparql-link-traversal'
import { fetch } from '@inrupt/solid-client-authn-browser'
import type { BaseQueryFn } from '@reduxjs/toolkit/dist/query/baseQueryTypes'
import { createApi } from '@reduxjs/toolkit/dist/query/react'
import { DataFactory, Quad, Triple, Writer } from 'n3'
import { acl, dct, foaf, rdf, schema_https, sioc, vcard } from 'rdf-namespaces'
import { Accommodation, URI } from 'types'
// import { bindingsStreamToGraphQl } from '@comunica/actor-query-result-serialize-tree'
// import { accommodationContext } from 'ldo/accommodation.context'

const geo = 'http://www.w3.org/2003/01/geo/wgs84_pos#'
const hospex = 'http://w3id.org/hospex/ns#'

const { namedNode, literal, quad } = DataFactory

const myEngine = new QueryEngine()
// const gql = ([s]: TemplateStringsArray) => s

const comunicaBaseQuery =
  (
    { baseSources }: { baseSources: string[] } = { baseSources: [] },
  ): BaseQueryFn<{
    query: string
    sources: [URI, ...URI[]]
    invalidate?: boolean | URI[]
  }> =>
  async ({ query, sources, invalidate = false }) => {
    if (invalidate) {
      if (Array.isArray(invalidate))
        await Promise.all(
          invalidate.map(url => myEngine.invalidateHttpCache(url)),
        )
      else await myEngine.invalidateHttpCache()
    }

    const bindingsStream = await myEngine.queryBindings(query, {
      sources: [...baseSources, ...sources] as [string, ...string[]],
      fetch,
    })
    return {
      data: (await bindingsStream.toArray()).map(binding => {
        const keys = Array.from(binding.keys()).map(({ value }) => value)

        return Object.fromEntries(
          keys.map(key => [key, binding.get(key as string)?.value ?? null]),
        )
      }),
    }
  }

export const comunicaApi = createApi({
  reducerPath: 'comunicaApi',
  baseQuery: comunicaBaseQuery(),
  tagTypes: ['Accommodation'],
  endpoints: builder => ({
    readAccommodations: builder.query<
      Accommodation[],
      {
        webId: URI
        personalHospexDocuments: [URI, ...URI[]]
        language?: string
      }
    >({
      query: ({ webId, personalHospexDocuments, language = 'en' }) => ({
        query: query`
          SELECT ?accommodation ?description ?latitude ?longitude WHERE {
            <${webId}> <${hospex}offers> ?accommodation.
            ?accommodation
              <${dct.description}> ?description;
              <${geo}location> ?location.
            ?location a <${geo}Point>;
              <${geo}lat> ?latitude;
              <${geo}long> ?longitude.

            FILTER(LANG(?description) = "${language}")
          }
        `,
        sources: personalHospexDocuments,
      }),
      transformResponse: (
        accommodations: {
          accommodation: URI
          description: string
          latitude: number
          longitude: number
        }[],
      ) =>
        accommodations.map(
          ({ accommodation, description, latitude, longitude }) => ({
            id: accommodation,
            description,
            location: {
              lat: Number(latitude),
              long: Number(longitude),
            },
          }),
        ),
      providesTags: (result, error, arg) => [
        ...(result?.map(accommodation => ({
          type: 'Accommodation' as const,
          id: accommodation.id,
        })) ?? []),
        { type: 'Accommodation', id: `LIST_OF_${arg.webId}` },
      ],
    }),
    createAccommodation: builder.mutation<
      null,
      {
        webId: URI
        accommodation: Accommodation
        personalHospexDocument: URI
      }
    >({
      queryFn: async ({ webId, accommodation, personalHospexDocument }) => {
        await saveAccommodation({
          webId,
          personalHospexDocument,
          data: accommodation,
        })

        return { data: null }
      },
      invalidatesTags: (res, err, arg) => [
        { type: 'Accommodation', id: `LIST_OF_${arg.webId}` },
        { type: 'Accommodation', id: arg.accommodation.id },
      ],
    }),
    deleteAccommodation: builder.mutation<
      null,
      { webId: URI; id: URI; personalHospexDocument: URI }
    >({
      queryFn: async ({ webId, id, personalHospexDocument }) => {
        await deleteAccommodation({
          webId,
          personalHospexDocument,
          id,
        })

        return { data: null }
      },
      invalidatesTags: (res, err, arg) => [
        { type: 'Accommodation', id: `LIST_OF_${arg.webId}` },
        { type: 'Accommodation', id: arg.id },
      ],
    }),
    saveCommunity: builder.mutation<
      unknown,
      {
        groupId: URI
        communityId: URI
        webId: URI
        data: { name: string; description: string }
      }
    >({
      queryFn: async props => {
        await saveCommunity(props)
        return { data: null }
      },
    }),
  }),
})

// export const readAccommodations = async ({
//   webId,
//   personalHospexDocuments,
//   language = 'en',
// }: {
//   webId: URI
//   personalHospexDocuments: [URI, ...URI[]]
//   language?: string
// }) => {
//   const result = await myEngine.queryBindings(
//     `
//     SELECT ?accommodation ?description ?latitude ?longitude WHERE {
//       <${webId}> <${hospex}offers> ?accommodation.
//       ?accommodation
//         <${dct.description}> ?description;
//         <${geo}location> ?location.
//       ?location a <${geo}Point>;
//         <${geo}lat> ?latitude;
//         <${geo}long> ?longitude.

//       FILTER(LANG(?description) = "${language}")
//     }
//   `,
//     { sources: [...personalHospexDocuments], fetch, lenient: true },
//   )

//   // result.on('data', bindings => console.log(bindings))
//   return await result.toArray()
// }

// export const readAccommodation = async () => {
//   myEngine.invalidateHttpCache()
//   const result = await myEngine.query(
//     gql`
//       {
//         id
//         ... on Accommodation {
//           comment
//           location(type: Point) @single {
//             lat @single
//             long @single
//           }
//         }
//       }
//     `,
//     {
//       sources: ['https://mrkvon.inrupt.net/public/hospex.ttl'],
//       queryFormat: {
//         language: 'graphql',
//         version: '1.0',
//       },
//       '@context': {
//         ...accommodationContext,
//         type: rdf.type,
//         Accommodation: 'https://hospex.example.com/terms/0.1#Accommodation',
//       },
//       sparqlJsonToTreeConverter: () => {},
//       asdf: '',
//     },
//   )

//   const data = await bindingsStreamToGraphQl(
//     (await result.execute()) as any,
//     result.context,
//     { materializeRdfJsTerms: false },
//   )

//   return data
// }

export const saveCommunity = async ({
  groupId,
  communityId,
  webId,
  data,
}: {
  communityId: URI
  groupId: URI
  webId: URI
  data: {
    name: string
    description: string
  }
}) => {
  // save community data
  const communityQuery = query`INSERT DATA {
    <${communityId}>
        <${rdf.type}>
            <${hospex}Community>,
            <${sioc.Community}>;
        <${sioc.name}> "${data.name}"@en;
        <${sioc.about}> """${data.description}"""@en;
        <${sioc.has_usergroup}> <${groupId}>.
  }`
  await myEngine.queryVoid(communityQuery, {
    sources: [communityId],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: communityId },
    fetch,
  })

  // save group data
  const groupQuery = query`INSERT DATA {
    <${groupId}>
        <${rdf.type}>
            <${sioc.Usergroup}>,
            <${vcard.Group}>;
        <${sioc.has_usergroup}> <${communityId}>.
  }`
  await myEngine.queryVoid(groupQuery, {
    sources: [groupId],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: groupId },
    fetch,
  })

  // set readonly public permissions on community
  const communityDocument = removeHashFromURI(communityId)
  const communityAcl = communityDocument + '.acl'
  const communityAclQuery = query`INSERT DATA {
    <${communityAcl}#Control>
        <${rdf.type}> <${acl.Authorization}>;
        <${acl.agent}> <${webId}>;
        <${acl.accessTo}> <${communityDocument}>;
        <${acl.mode}> <${acl.Read}>, <${acl.Write}>, <${acl.Control}>.
    <${communityAcl}#Read>
        <${rdf.type}> <${acl.Authorization}>;
        <${acl.agentClass}> <${foaf.Agent}>;
        <${acl.accessTo}> <${communityDocument}>;
        <${acl.mode}> <${acl.Read}>.
  }`
  await myEngine.queryVoid(communityAclQuery, {
    sources: [communityAcl],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: communityAcl },
    fetch,
  })

  // set read & append on group
  const groupDocument = removeHashFromURI(groupId)
  const groupAcl = groupDocument + '.acl'
  const groupAclQuery = query`INSERT DATA {
    <${groupAcl}#Control>
        <${rdf.type}> <${acl.Authorization}>;
        <${acl.agent}> <${webId}>;
        <${acl.accessTo}> <${groupDocument}>;
        <${acl.mode}> <${acl.Read}>, <${acl.Write}>, <${acl.Control}>.
    <${groupAcl}#Read>
        <${rdf.type}> <${acl.Authorization}>;
        <${acl.agentClass}> <${foaf.Agent}>;
        <${acl.agentGroup}> <${groupId}>;
        <${acl.accessTo}> <${groupDocument}>;
        <${acl.mode}> <${acl.Read}>.
    <${groupAcl}#Append>
        <${rdf.type}> <${acl.Authorization}>;
        <${acl.agentClass}> <${acl.AuthenticatedAgent}>;
        <${acl.accessTo}> <${groupDocument}>;
        <${acl.mode}> <${acl.Append}>.
  }`
  await myEngine.queryVoid(groupAclQuery, {
    sources: [groupAcl],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: groupAcl },
    fetch,
  })

  await myEngine.invalidateHttpCache()
}

function removeHashFromURI(uri: string): string {
  const url = new URL(uri)
  url.hash = ''
  return url.toString()
}

export const saveAccommodation = async ({
  webId,
  personalHospexDocument,
  data,
  language = 'en',
}: {
  webId: URI
  personalHospexDocument: URI
  data: Accommodation
  language?: string
}) => {
  // save accommodation
  const insertions: Quad[] = []
  // const deletions: Quad[] = []

  const lu = new URL(data.id)
  lu.hash = 'location'
  const locationUri = lu.toString()

  const au = new URL(data.id)
  au.hash = 'accommodation'
  const auri = au.toString()

  insertions.push(
    quad(
      namedNode(auri),
      namedNode(rdf.type),
      namedNode(hospex + 'Accommodation'),
    ),
    quad(
      namedNode(auri),
      namedNode(rdf.type),
      namedNode(schema_https.Accommodation),
    ),
    quad(
      namedNode(auri),
      namedNode(dct.description),
      literal(data.description, language),
    ),
    quad(namedNode(auri), namedNode(geo + 'location'), namedNode(locationUri)),
    quad(namedNode(locationUri), namedNode(rdf.type), namedNode(geo + 'Point')),
    quad(
      namedNode(locationUri),
      namedNode(geo + 'lat'),
      literal(data.location.lat),
    ),
    quad(
      namedNode(locationUri),
      namedNode(geo + 'long'),
      literal(data.location.long),
    ),
    quad(namedNode(auri), namedNode(hospex + 'offeredBy'), namedNode(webId)),
  )

  // TODO this query currently deletes descriptions in all languages
  // it also assumes a specific format of locationUri, which might be wrong
  const newAccommodationQuery = query`DELETE {
    <${auri}> <${dct.description}> ?description.
    ?location ?predicate ?object.
  } INSERT {${insertions}} WHERE {
    <${auri}> <${dct.description}> ?description.
    <${auri}> <${geo}location> ?location.
    ?location ?predicate ?object.
    #FILTER(LANG(?description) = "${language}") #look closer at this
    #FILTER(isLiteral(?description) && langMatches(lang(?description), "en"))
  }; INSERT DATA {${insertions}}`

  // const newAccommodationQuery = query`INSERT DATA {${insertions}}`

  await myEngine.queryVoid(newAccommodationQuery, {
    sources: [data.id],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: data.id },
    fetch,
  })

  // save user offers accommodation
  await myEngine.queryVoid(
    query`INSERT DATA {${[
      quad(namedNode(webId), namedNode(hospex + 'offers'), namedNode(auri)),
    ]}}`,
    {
      sources: [personalHospexDocument],
      destination: { type: 'patchSparqlUpdate', value: personalHospexDocument },
      fetch,
    },
  )

  await myEngine.invalidateHttpCache()
}

const query = (
  strings: TemplateStringsArray,
  ...rest: (Triple[] | string)[]
) => {
  const writer = new Writer()
  const texts = [...strings]

  let output = texts.shift() ?? ''

  for (const quads of rest) {
    output += typeof quads === 'string' ? quads : writer.quadsToString(quads)
    output += texts.shift() as string
  }

  return output
}

export const deleteAccommodation = async ({
  id,
  webId,
  personalHospexDocument,
}: {
  id: URI
  webId: URI
  personalHospexDocument: URI
}) => {
  // delete data from accommodation
  const deleteAccommodationQuery = query`DELETE {
    <${id}> ?predicate ?object.
    <${id}> <${geo}location> ?location.
    ?location ?lpredicate ?lobject.
  } WHERE {
    <${id}> ?predicate ?object.
    <${id}> <${geo}location> ?location.
    ?location ?lpredicate ?lobject.
  }`

  const deletePersonalProfileReferenceQuery = query`DELETE DATA {
    <${webId}> <${hospex}offers> <${id}>.
  }`

  // delete the accommodation
  await myEngine.queryVoid(deleteAccommodationQuery, {
    sources: [id],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: id },
    fetch,
  })

  // delete mention of the accommodation from personalHospexDocument
  await myEngine.queryVoid(deletePersonalProfileReferenceQuery, {
    sources: [personalHospexDocument],
    lenient: true,
    destination: { type: 'patchSparqlUpdate', value: personalHospexDocument },
    fetch,
  })

  // delete file if empty
  const file = await (await fetch(id)).text()
  if (!file.trim()) await fetch(id, { method: 'DELETE' })

  await myEngine.invalidateHttpCache()
}
