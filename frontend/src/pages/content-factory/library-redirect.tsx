import { Navigate, useParams } from "react-router"

/** /libraries/:id/content-factory → 项目推广主页 */
export function ContentFactoryLibraryRedirect() {
  const { libraryId } = useParams()
  return (
    <Navigate
      to={`/libraries/${libraryId}/content-factory/project-promotion`}
      replace
    />
  )
}
